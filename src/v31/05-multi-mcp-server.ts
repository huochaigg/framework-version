import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import {
  END,
  MessagesValue,
  START,
  StateGraph,
  StateSchema
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createChatModel, printError } from "../config/llm";
import { printAgentTrace, stdioConnection } from "./shared";

/**
 * V31 Demo 5 · 一个 Agent 同时使用两个 MCP Server
 *
 * Server A：calculator-server.ts → calculator
 * Server B：user-server.ts → getUserInfo
 *
 * MultiServerMCPClient.getTools() 会把两个 Server 的 Tool 展平成一份列表。
 * Agent 拿到的仍然是普通 LangChain Tools，不需要自己写服务发现、Gateway、权限系统。
 *
 * 运行：pnpm v31-multi-server
 */

const AgentState = new StateSchema({
  messages: MessagesValue
});

const AGENT_SYSTEM_PROMPT =
  "你是一名助手。查用户信息时调用 getUserInfo。做算术时调用 calculator。不要自己编造结果。用中文简短回答。";

async function main() {
  const mcpClient = new MultiServerMCPClient({
    mcpServers: {
      calculator: stdioConnection("calculator-server.ts"),
      user: stdioConnection("user-server.ts")
    }
  });

  try {
    const mcpTools = await mcpClient.getTools();
    console.log(
      "Tools from two MCP servers:",
      mcpTools.map((tool) => tool.name).join(", ")
    );
    console.log("");

    const modelWithTools = createChatModel().bindTools(mcpTools);

    const callModel = async (state: typeof AgentState.State) => {
      const response = await modelWithTools.invoke(state.messages);
      return { messages: [response] };
    };

    const shouldContinue = (state: typeof AgentState.State) => {
      const lastMessage = state.messages.at(-1);
      const toolCalls =
        lastMessage && lastMessage.getType() === "ai"
          ? (lastMessage as AIMessage).tool_calls
          : undefined;

      if (toolCalls && toolCalls.length > 0) {
        return "tools";
      }

      return END;
    };

    const innerToolNode = new ToolNode(mcpTools);
    const toolsNode = async (state: typeof AgentState.State) => {
      return innerToolNode.invoke(state);
    };

    const graph = new StateGraph(AgentState)
      .addNode("callModel", callModel)
      .addNode("tools", toolsNode)
      .addEdge(START, "callModel")
      .addConditionalEdges("callModel", shouldContinue)
      .addEdge("tools", "callModel")
      .compile();

    const question =
      "查询 user-001 的信息，然后算一下他的工龄 6 年乘以 12 是多少个月。";

    console.log(`=== ${question} ===`);

    const finalState = await graph.invoke(
      {
        messages: [
          new SystemMessage(AGENT_SYSTEM_PROMPT),
          new HumanMessage(question)
        ]
      },
      { recursionLimit: 12 }
    );

    printAgentTrace(finalState.messages);
  } finally {
    await mcpClient.close();
  }
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
