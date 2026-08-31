import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { printError } from "../config/llm";
import {
  DEMO_THREAD_ID,
  SYSTEM_PROMPT,
  createChatGraph,
  createPostgresCheckpointer,
  lastModelAnswer
} from "./shared";

/**
 * V29-2 · 把 Checkpoint 写入 PostgreSQL，然后进程退出
 *
 * 只做一轮对话。不要在同一个进程里继续问第二轮。
 * 实验设计就是：进程 A 保存 → 进程 A 退出 → 再跑 v29-resume。
 *
 * 写入发生在 Graph 内部的 checkpointer.put()，不必跟进官方源码。
 * invoke 返回后，用断点看 graph.getState 即可确认 State 已在 Checkpointer 里。
 */
async function main() {
  const checkpointer = createPostgresCheckpointer();

  try {
    const graph = createChatGraph(checkpointer);
    const config = { configurable: { thread_id: DEMO_THREAD_ID } };
    const question = "我叫小明，我最常用的前端框架是 Vue。";

    // 打断点 2：第一次 invoke 前，这个 thread 还没有本轮 HumanMessage。
    const result = await graph.invoke(
      {
        messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(question)]
      },
      config
    );
    // 打断点 3：invoke 已经结束，官方 Checkpointer 已把 State 写入 PostgreSQL。
    // 建议在这里看 result.messages，或 step into 后的 graph.getState，不要 dump 数据库对象。
    const snapshot = await graph.getState(config);
    void snapshot;

    console.log(`thread_id: ${DEMO_THREAD_ID}`);
    console.log(`用户输入：${question}`);
    console.log(`最终回答：${lastModelAnswer(result.messages)}`);
    console.log("Checkpoint 已持久化");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  } finally {
    await checkpointer.end();
  }
}

await main();
