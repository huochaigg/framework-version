import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { printError } from "../config/llm";
import {
  SYSTEM_PROMPT,
  createChatGraph,
  createPostgresCheckpointer,
  lastModelAnswer
} from "./shared";

/**
 * V29-4 · thread 隔离
 *
 * 数据库可以保存很多条 Graph 线程，每个 thread_id 拥有独立 State。
 * 不要把所有用户共用一个固定 thread_id。
 *
 * 真实聊天系统常见映射：
 *   userId         = 哪个用户
 *   conversationId = 哪一条聊天会话
 *   LangGraph 里经常可以把 conversationId 映射成 thread_id
 * 不要写死「thread_id 必须等于 conversationId」，只是实际项目经常这样映射。
 */
async function main() {
  const checkpointer = createPostgresCheckpointer();

  try {
    const graph = createChatGraph(checkpointer);
    const configA = { configurable: { thread_id: "thread-a" } };
    const configB = { configurable: { thread_id: "thread-b" } };

    await graph.invoke(
      {
        messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage("我叫张三")]
      },
      configA
    );

    await graph.invoke(
      {
        messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage("我叫李四")]
      },
      configB
    );

    // 打断点 5：thread-a 进入 callModel 时，历史应是张三，不应出现李四。
    const answerA = await graph.invoke(
      { messages: [new HumanMessage("我叫什么？")] },
      configA
    );

    // 打断点 5 对照：thread-b 进入 callModel 时，历史应是李四，不应出现张三。
    const answerB = await graph.invoke(
      { messages: [new HumanMessage("我叫什么？")] },
      configB
    );

    console.log("thread-a 第 1 轮：我叫张三");
    console.log("thread-b 第 1 轮：我叫李四");
    console.log(`thread-a 问我叫什么：${lastModelAnswer(answerA.messages)}`);
    console.log(`thread-b 问我叫什么：${lastModelAnswer(answerB.messages)}`);
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  } finally {
    await checkpointer.end();
  }
}

await main();
