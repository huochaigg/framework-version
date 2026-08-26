import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { createChatModel, printError } from "../config/llm";

/**
 * Demo 3：PromptTemplate / ChatPromptTemplate
 *
 * 手写版本常见写法：
 *   const prompt = `你是一名${level}导师，请解释${technology}里的：${question}`
 *
 * LangChain：
 *   PromptTemplate        → 产出一段字符串
 *   ChatPromptTemplate    → 产出一组 Chat Messages
 *
 * 模板负责「填变量」，模型负责「生成」。两者分开后，同一套 Prompt 可以复用到不同模型。
 */
async function runPromptTemplateDemo() {
  console.log("========== 1. PromptTemplate：填变量，得到字符串 ==========\n");

  const stringPrompt = PromptTemplate.fromTemplate(
    "你正在教一名{level}学习{technology}。请用对方能听懂的方式回答：{question}"
  );

  const variables = {
    technology: "LangChain",
    level: "初学者",
    question: "LCEL 是什么？"
  };

  // 打断点建议：看 stringPrompt.invoke 的返回值，确认只是填空，没有调用模型
  const filledPrompt = await stringPrompt.invoke(variables);

  console.log("变量：", variables);
  console.log("填空后的 Prompt：\n");
  console.log(filledPrompt.toString());
  console.log("");
}

async function runChatPromptTemplateDemo() {
  console.log("========== 2. ChatPromptTemplate：填变量，得到 Messages ==========\n");

  const chatPrompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一名{technology}导师。学生水平是{level}，请用中文讲解。"],
    ["human", "{question}"]
  ]);

  const variables = {
    technology: "LangChain",
    level: "初学者",
    question: "LCEL 是什么？"
  };

  const promptValue = await chatPrompt.invoke(variables);
  const messages = promptValue.toChatMessages();

  console.log("填空后得到的 Messages：\n");
  for (const message of messages) {
    console.log(`[${message.getType()}] ${message.content}`);
    console.log("");
  }

  const model = createChatModel();
  const aiMessage = await model.invoke(promptValue);

  console.log("模型回答：\n");
  console.log(aiMessage.content);
  console.log("\nChatPromptTemplate 更适合 Chat Model，因为输出直接是 messages 数组。");
}

async function main() {
  try {
    await runPromptTemplateDemo();
    await runChatPromptTemplateDemo();
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
