import { printError } from "../config/llm";
import { createAgentRuntime, prepareTurn } from "./agent/graph";
import { lastModelAnswer, usedToolNamesThisTurn } from "./agent/trace";

/**
 * CLI 固定问题。用来单独打断点看 Tool / RAG / MCP。
 * 和 HTTP Server 共用 createAgentRuntime()。
 */

const QUESTIONS = [
  "什么是 LangGraph Checkpoint？",
  "23 * 47 等于多少？",
  "现在东京几点？",
  "查询 demo-project 项目信息。",
  "你好，介绍一下你自己。"
];

async function main() {
  const runtime = await createAgentRuntime();
  const conversationId = `v32-cli-${Date.now()}`;

  try {
    for (const [index, question] of QUESTIONS.entries()) {
      if (index > 0) {
        console.log("");
      }

      console.log(`=== ${question} ===`);

      const { input, config } = await prepareTurn(
        runtime.graph,
        conversationId,
        question
      );
      const result = await runtime.graph.invoke(input, config);
      const tools = usedToolNamesThisTurn(result.messages);

      console.log(`Tools → ${tools.length > 0 ? tools.join(", ") : "(none)"}`);
      console.log(`Answer → ${lastModelAnswer(result.messages)}`);
    }
  } finally {
    await runtime.close();
  }
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
