import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  END,
  MessagesValue,
  START,
  StateGraph,
  StateSchema
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createChatModel, printError } from "../config/llm";
import { calculator } from "../tools/calculator";
import {
  lastModelAnswer,
  projectHint,
  requireLangSmithConfig,
  traceConfig
} from "./shared";

/**
 * V33-3 · 把 Agent Loop 变成一张完整调用链
 *
 * Model → tool_calls → calculator → ToolMessage → Model → Final Answer
 *
 * LangSmith 重点找：
 * 1. 第一次 Model Run 和 AIMessage.tool_calls
 * 2. calculator Tool Run：输入 a=23 b=47 operation=multiply，输出 1081
 * 3. 第二次 Model Run 的输入里已经有 ToolMessage
 *
 * 打断点：AIMessage.tool_calls、Tool 真正执行、ToolMessage 回到模型之前。
 */

const AgentState = new StateSchema({
  messages: MessagesValue
});

const tools = [calculator];

async function main() {
  requireLangSmithConfig();

  const modelWithTools = createChatModel().bindTools(tools);

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
    return toolCalls && toolCalls.length > 0 ? "tools" : END;
  };

  const graph = new StateGraph(AgentState)
    .addNode("callModel", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue)
    .addEdge("tools", "callModel")
    .compile();

  const result = await graph.invoke(
    {
      messages: [
        new SystemMessage(
          "你是一名助手。需要计算时必须调用 calculator，不要自己心算。"
        ),
        new HumanMessage("23 * 47 等于多少？")
      ]
    },
    traceConfig("v33-tool-agent", {
      tags: ["tool"],
      metadata: { feature: "tool-agent" }
    })
  );

  console.log(lastModelAnswer(result.messages));
  console.log(`\n去 LangSmith 看 Model → calculator → Model。Project：${projectHint()}`);
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
