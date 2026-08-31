import { printError } from "../config/llm";
import { createCallModelGraph, textFromModel } from "./shared";

/**
 * V30-3 · streamMode: "messages"
 *
 * Graph Streaming：Graph 执行到哪一步、State 怎么变（values / updates）。
 * Model Streaming：某次 LLM 调用正在生成哪些 token/chunk。
 *
 * 手写 V2：直接 for await chunk.choices[0].delta.content
 * LangGraph：graph.stream(..., { streamMode: "messages" }) 把 Graph 里模型产生的流暴露出来。
 *
 * 即使 Node 里写的是 model.invoke()，messages 模式仍会流出 token。
 * 不要用 setTimeout 假切字符串。
 */
async function main() {
  try {
    const graph = createCallModelGraph();
    const question = "用一两句话解释 LangGraph 是什么。";

    console.log(`问题：${question}`);
    console.log("streamMode: messages");
    console.log("模型输出：");
    console.log("");

    const stream = await graph.stream(
      { question },
      { streamMode: "messages" }
    );

    for await (const event of stream) {
      // 打断点 3：每个 chunk 只是一小段文本，不是完整 AIMessage
      const [chunk] = event;
      const text = textFromModel(chunk.content);
      if (text) {
        process.stdout.write(text);
      }
    }

    console.log("");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
