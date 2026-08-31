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
 * V31 Demo 4 · LangGraph Agent + MCP Tool
 *
 * V23 的 Agent Loop 没变：
 *   START → callModel → 有 tool_calls？ → ToolNode → callModel → END
 *
 * 区别：
 *   V23 calculator 是本项目里的 LangChain Tool（本地 JS）。
 *   V31 calculator / getUserInfo 来自外部 MCP Server。
 *
 * 对 LangGraph 来说，它不关心 Tool 背后是当前进程的函数，
 * 还是另一个进程里的 MCP Tool。看到的都是符合 Tool 接口的能力。
 *
 * 完整链路：
 *   User
 *     → LangGraph callModel
 *     → AIMessage.tool_calls
 *     → ToolNode
 *     → LangChain Tool（Adapter 转出来的）
 *     → MCP Client
 *     → MCP Server
 *     → JS Function
 *     → ToolMessage
 *     → callModel
 *     → Final Answer
 *
 * MCP 不负责 Agent 推理。LangGraph 不负责提供外部业务能力。
 *
 * 运行：pnpm v31-agent
 * 不要接着自动跑 multi-server。
 */

const AgentState = new StateSchema({
  messages: MessagesValue
});

const AGENT_SYSTEM_PROMPT =
  "你是一名助手。需要计算时调用 calculator。需要查用户信息时调用 getUserInfo。不要自己编造算术结果或用户资料。用中文简短回答。";

async function main() {
  const mcpClient = new MultiServerMCPClient({
    mcpServers: {
      v31: stdioConnection("01-mcp-server.ts")
    }
  });

  try {
    const mcpTools = await mcpClient.getTools();
    const modelWithTools = createChatModel().bindTools(mcpTools);

    const callModel = async (state: typeof AgentState.State) => {
      // 打断点 4：第一次应有 tool_calls。
      // 打断点 7：第二次 messages 里应已有 ToolMessage。
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
      // 打断点 5：ToolNode 准备执行 MCP Tool（对它来说只是普通 Tool.invoke）。
      return innerToolNode.invoke(state);
    };

    const graph = new StateGraph(AgentState)
      .addNode("callModel", callModel)
      .addNode("tools", toolsNode)
      .addEdge(START, "callModel")
      .addConditionalEdges("callModel", shouldContinue)
      .addEdge("tools", "callModel")
      .compile();

    const questions = [
      "23 * 47 等于多少？",
      "查询用户 user-001 的信息。"
    ];

    for (const [index, question] of questions.entries()) {
      if (index > 0) {
        console.log("");
      }

      console.log(`=== ${question} ===`);

      const finalState = await graph.invoke(
        {
          messages: [
            new SystemMessage(AGENT_SYSTEM_PROMPT),
            new HumanMessage(question)
          ]
        },
        { recursionLimit: 10 }
      );

      printAgentTrace(finalState.messages);
    }
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
