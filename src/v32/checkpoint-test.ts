import { printError } from "../config/llm";
import { createAgentRuntime, prepareTurn } from "./agent/graph";
import { lastModelAnswer } from "./agent/trace";

/**
 * 只测同一个 conversationId 的 PostgreSQL Checkpoint 恢复。
 * 不要自己维护内存 messages。第二轮只发新的 HumanMessage。
 */

const CONVERSATION_ID = `v32-checkpoint-${Date.now()}`;

async function main() {
  const runtime = await createAgentRuntime();

  try {
    const first = "我主要用 Vue。";
    const second = "我刚才说我主要用什么框架？";

    const turn1 = await prepareTurn(runtime.graph, CONVERSATION_ID, first);
    // 打断点：conversationId / thread_id 进入 Checkpointer。
    const result1 = await runtime.graph.invoke(turn1.input, turn1.config);
    console.log(`conversationId: ${CONVERSATION_ID}`);
    console.log(`thread_id: ${turn1.threadId}`);
    console.log(`User → ${first}`);
    console.log(`Answer → ${lastModelAnswer(result1.messages)}`);
    console.log("");

    const turn2 = await prepareTurn(runtime.graph, CONVERSATION_ID, second);
    const result2 = await runtime.graph.invoke(turn2.input, turn2.config);
    console.log(`User → ${second}`);
    console.log(`Answer → ${lastModelAnswer(result2.messages)}`);
    console.log(
      "重启 pnpm v32-server 后，用同一个 conversationId 继续问，也应能恢复 Vue。"
    );
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
