import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage
} from "@langchain/core/messages";
import { END, MessagesValue, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createChatModel, printError } from "../config/llm";
import { calculator } from "../tools/calculator";
import { getCurrentTime } from "../tools/current-time";

/**
 * V23 · LangGraph Agent Loop
 *
 * 手写 Agent Loop 本质是：
 *   模型节点 + 工具节点 + 条件判断 + 回边循环
 *
 * LangGraph 只是把原来的 while + if + messages + executeTool 显式建模成 Graph。
 *
 * 这一版不做 Memory / Checkpoint / RAG / MCP / Streaming。
 */

const tools = [calculator, getCurrentTime];

// V22 的 State 是 question / analysis / answer。
// V23 的核心 State 是不断增长的 messages：
//   HumanMessage → AIMessage(tool_calls) → ToolMessage → AIMessage
const AgentState = new StateSchema({
  messages: MessagesValue
});

function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

function summarizeToolResult(content: unknown): string {
  const text = textFromModel(content);

  try {
    const parsed = JSON.parse(text) as {
      result?: unknown;
      localTime?: unknown;
    };

    if (parsed.result !== undefined) {
      return String(parsed.result);
    }

    if (parsed.localTime !== undefined) {
      return String(parsed.localTime);
    }
  } catch {
    // Tool 结果不是 JSON 时，原样截断即可。
  }

  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function printTrace(messages: BaseMessage[]) {
  for (const message of messages) {
    if (message.getType() === "human") {
      console.log(`User → ${textFromModel(message.content)}`);
      continue;
    }

    if (message.getType() === "ai") {
      const aiMessage = message as AIMessage;
      const toolCalls = aiMessage.tool_calls ?? [];

      if (toolCalls.length > 0) {
        const names = toolCalls.map((call) => call.name).join(", ");
        console.log(`Model → 请求调用 ${names}`);
        continue;
      }

      console.log(`Model → ${textFromModel(aiMessage.content)}`);
      continue;
    }

    if (message.getType() === "tool") {
      const toolMessage = message as ToolMessage;
      console.log(
        `Tool → ${toolMessage.name ?? "unknown"} 返回 ${summarizeToolResult(toolMessage.content)}`
      );
    }
  }
}

async function main() {
  try {
    const modelWithTools = createChatModel().bindTools(tools);

    // callModel 只负责思考：把 messages 发给模型，把 AIMessage 加回 State。
    // 不要在这里执行 Tool。
    const callModel = async (state: typeof AgentState.State) => {
      // 打断点 1 / 5：第一次进来时 messages 通常是 System + Human
      // 打断点 5：第二次进来时应已经有 AIMessage(tool_calls) + ToolMessage
      const response = await modelWithTools.invoke(state.messages);
      // 打断点 2：看 response.tool_calls
      return { messages: [response] };
    };

    // 对应手写 V7：if (assistantMessage.tool_calls?.length) { ... } else { break }
    // LangGraph 不再手写 if + break，而是用 Conditional Edge 决定下一步。
    const shouldContinue = (state: typeof AgentState.State) => {
      const lastMessage = state.messages.at(-1);
      const toolCalls =
        lastMessage && lastMessage.getType() === "ai"
          ? (lastMessage as AIMessage).tool_calls
          : undefined;

      // 打断点 3：看这里返回 "tools" 还是 END
      if (toolCalls && toolCalls.length > 0) {
        return "tools";
      }

      return END;
    };

    // ToolNode 读取最后一条 AIMessage 的 tool_calls，执行对应 Tool，
    // 把结果写成 ToolMessage 加回 messages。
    // 模型第二次思考时，必须看到这条 ToolMessage，才知道工具已经跑完、结果是什么。
    const innerToolNode = new ToolNode(tools);
    const toolsNode = async (state: typeof AgentState.State) => {
      const update = await innerToolNode.invoke(state);
      // 打断点 4：看 update 里新加的 ToolMessage
      return update;
    };

    const graph = new StateGraph(AgentState)
      .addNode("callModel", callModel)
      .addNode("tools", toolsNode)
      .addEdge(START, "callModel")
      .addConditionalEdges("callModel", shouldContinue)
      // 真正的循环不是 while(true)，而是这条回边：tools → callModel
      .addEdge("tools", "callModel")
      .compile();

    const questions = [
      "23 * 47 等于多少？",
      "现在东京几点？",
      "简单解释一下 LangGraph"
    ];

    for (const [index, question] of questions.entries()) {
      if (index > 0) {
        console.log("");
      }

      console.log(`=== ${question} ===`);

      const finalState = await graph.invoke(
        {
          messages: [
            new SystemMessage(
              "你是一名助手。需要计算时调用 calculator，需要当前时间时调用 getCurrentTime。不要自己编造算术结果或当前时间。普通概念题直接用中文简短回答。"
            ),
            new HumanMessage(question)
          ]
        },
        // recursionLimit 防止模型不断请求 Tool 时无限循环。正常 Agent 很快结束。
        { recursionLimit: 10 }
      );

      printTrace(finalState.messages);
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();

// graph.invoke
//   → START
//   → callModel
//   → shouldContinue
//   → tools（若有 tool_calls）
//   → callModel
//   → shouldContinue
//   → END
