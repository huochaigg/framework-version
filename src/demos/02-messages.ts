import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel, printError } from "../config/llm";

/**
 * Demo 2：Messages
 *
 * 手写 V4：
 *   { role: "system", content: "..." }
 *   { role: "user", content: "..." }
 *   { role: "assistant", content: "..." }
 *
 * LangChain：
 *   new SystemMessage(...)
 *   new HumanMessage(...)
 *   new AIMessage(...)
 *
 * 本质没变：模型没有记忆。所谓多轮，就是每次把消息数组重新发给模型。
 * 本 Demo 只用内存数组，不写数据库。
 */
async function main() {
  try {
    const model = createChatModel();

    const conversation = [
      new SystemMessage("你是一名前端和 AI 工程师导师。请用中文、简洁地继续讲解。"),
      new HumanMessage("什么是 Tool Calling？"),
      new AIMessage(
        "Tool Calling 是让模型提出「我要调用某个工具」的请求，而不是自己执行工具。模型只输出工具名和参数，真正执行发生在你的 Node 代码里。"
      ),
      new HumanMessage("继续解释。")
    ];

    console.log("========== 内存中的对话（发给模型之前）==========\n");

    for (const message of conversation) {
      console.log(`[${message.getType()}] ${message.content}`);
      console.log("");
    }

    console.log("对应关系：");
    console.log("- SystemMessage  ≈ role: system");
    console.log("- HumanMessage   ≈ role: user");
    console.log("- AIMessage      ≈ role: assistant");
    console.log("");

    console.log("========== 把整段历史一起发给模型 ==========\n");

    // 打断点建议：展开 conversation，确认 AIMessage 也会被带上
    const aiMessage = await model.invoke(conversation);

    console.log("模型继续回答：\n");
    console.log(aiMessage.content);
    console.log("\n注意：模型能「继续解释」，是因为上一轮 AIMessage 被重新传回去了。");
    console.log("不是 LangChain 帮你存了历史。程序退出后，这段数组就没了。");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
