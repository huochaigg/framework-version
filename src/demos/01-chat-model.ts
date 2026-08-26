import { createChatModel, printError } from "../config/llm";

/**
 * Demo 1：Chat Model
 *
 * 手写 V1：
 *   client.chat.completions.create({ model, messages, stream: false })
 *   → 等完整结果
 *
 * 手写 V2：
 *   client.chat.completions.create({ ..., stream: true })
 *   → for await chunk.choices[0].delta.content
 *
 * LangChain：
 *   model.invoke()  ≈ 非流式
 *   model.stream()  ≈ 流式
 *
 * ChatOpenAI 仍然会发 HTTP 请求。框架没有取消这次网络调用，
 * 只是把 SDK 细节藏进了统一的 Chat Model 接口。
 */
async function runInvokeDemo() {
  const model = createChatModel();
  const userInput = "你好，简单介绍一下 LangChain。";

  console.log("========== 1. model.invoke()：等完整结果 ==========\n");
  console.log("用户输入：", userInput);
  console.log("正在调用模型，请稍等...\n");

  // 打断点建议：停在这一行，Step Into 看 ChatOpenAI.invoke
  const aiMessage = await model.invoke(userInput);

  console.log("返回类型：", aiMessage.constructor.name);
  console.log("完整回答：\n");
  console.log(aiMessage.content);
  console.log("\n");
}

async function runStreamDemo() {
  const model = createChatModel();
  const userInput = "再用三句话总结 LangChain 适合解决什么问题。";

  console.log("========== 2. model.stream()：边生成边打印 ==========\n");
  console.log("用户输入：", userInput);
  console.log("流式输出：\n");

  // 打断点建议：停在 for await，观察每个 chunk 只有一小段文本
  const stream = await model.stream(userInput);
  
  for await (const chunk of stream) {
    const text = typeof chunk.content === "string" ? chunk.content : "";
    process.stdout.write(text);
  }

  console.log("\n");
  console.log("区别：");
  console.log("- invoke() 一次返回完整 AIMessage，适合 Structured Output / JSON");
  console.log("- stream() 多次返回 AIMessageChunk，适合给用户看打字效果");
  console.log("- 底层都是同一次 Chat Completions 请求，只是 stream 参数不同");
}

async function main() {
  try {
    await runInvokeDemo();
    await runStreamDemo();
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
