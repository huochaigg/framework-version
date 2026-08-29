import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage
} from "@langchain/core/messages";
import { createAgentGraph, AGENT_SYSTEM_PROMPT } from "./create-agent-graph";
import { printError } from "../config/llm";

/**
 * V23 · LangGraph Agent Loop
 *
 * 手写 Agent Loop 本质是：
 *   模型节点 + 工具节点 + 条件判断 + 回边循环
 *
 * 这一版不传 checkpointer。每次 invoke 都是一次新的执行，不保留会话。
 */

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
    const graph = createAgentGraph();

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
            new SystemMessage(AGENT_SYSTEM_PROMPT),
            new HumanMessage(question)
          ]
        },
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
