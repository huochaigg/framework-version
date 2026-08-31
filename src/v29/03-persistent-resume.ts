import { HumanMessage } from "@langchain/core/messages";
import { printError } from "../config/llm";
import {
  DEMO_THREAD_ID,
  createChatGraph,
  createPostgresCheckpointer,
  lastModelAnswer
} from "./shared";

/**
 * V29-3 · 新进程用同一个 thread_id 恢复 State
 *
 * 这是一个全新的 Node 进程。没有 JS 全局变量，也不读 JSON 文件，
 * 不手动复制 messages。只靠 PostgreSQL Checkpointer + thread_id。
 *
 * 先跑 pnpm v29-save 并让那个进程退出，再跑本文件。
 * 如果持久化成功，模型应能回答：小明、Vue。
 */
async function main() {
  const checkpointer = createPostgresCheckpointer();

  try {
    const graph = createChatGraph(checkpointer);
    const config = { configurable: { thread_id: 'DEMO_THREAD_ID' } };
    const question = "我叫什么？我常用什么前端框架？";

    // 打断点 4：新进程第一次进入 callModel 时，messages 里应已有 v29-save 保存的小明 / Vue。
    const result = await graph.invoke(
      { messages: [new HumanMessage(question)] },
      config
    );

    console.log(`thread_id: ${DEMO_THREAD_ID}`);
    console.log(`新问题：${question}`);
    console.log(`最终回答：${lastModelAnswer(result.messages)}`);
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  } finally {
    await checkpointer.end();
  }
}

await main();
