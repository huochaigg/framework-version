import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { printError } from "../config/llm";
import { SYSTEM_PROMPT, createChatGraph, lastModelAnswer } from "./shared";

/**
 * V29-1 · Memory Checkpointer 对照组
 *
 * MemorySaver 把 Graph State 存在当前 Node 进程内存里。
 * 同一个进程内，相同 thread_id 的第二轮可以恢复上一轮 messages。
 *
 * 如果现在退出进程再重新跑这个文件，第一轮保存的 State 会消失。
 * 这就是 V24 的 MemorySaver 只能算学习 Demo 的原因。
 */
async function main() {
  try {
    const checkpointer = new MemorySaver();
    const graph = createChatGraph(checkpointer);
    const config = { configurable: { thread_id: "v29-memory-thread" } };

    const round1 = await graph.invoke(
      {
        messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage("我叫小明")]
      },
      config
    );

    console.log("thread_id: v29-memory-thread");
    console.log("第 1 轮：我叫小明");
    console.log(`回答：${lastModelAnswer(round1.messages)}`);

    // 打断点 1：第二轮进入 callModel 时，messages 应已包含「我叫小明」和第一轮 AI 回答。
    // 不要把上一轮 messages 手动再传进去，靠 MemorySaver + thread_id 恢复。
    const round2 = await graph.invoke(
      { messages: [new HumanMessage("我叫什么？")] },
      config
    );

    console.log("第 2 轮：我叫什么？");
    console.log(`回答：${lastModelAnswer(round2.messages)}`);
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
