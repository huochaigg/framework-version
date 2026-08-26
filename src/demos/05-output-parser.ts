import { JsonOutputParser, StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createChatModel, printError } from "../config/llm";

/**
 * Demo 5：Output Parser
 *
 * Parser 不负责调用模型。它只负责：
 *   模型吐出来的内容  →  程序更好用的数据
 *
 * 手写版本：
 *   const text = completion.choices[0].message.content
 *   const data = JSON.parse(text)
 *
 * LangChain：
 *   StringOutputParser  → AIMessage.content 变成 string
 *   JsonOutputParser    → 从文本里抽出 JSON，变成 JS 对象
 *
 * 注意：JsonOutputParser 只保证「能 parse 成对象」，不保证字段一定符合业务 Schema。
 * 字段级校验是下一个 Demo（Structured Output + Zod）的事。
 */

type ArticleSummary = {
  title: string;
  summary: string;
  tags: string[];
};

async function runStringParserDemo() {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "用一句中文回答。"],
    ["human", "{question}"]
  ]);
  const model = createChatModel();
  const parser = new StringOutputParser();
  const chain = prompt.pipe(model).pipe(parser);

  console.log("========== 1. StringOutputParser ==========\n");

  const result = await chain.invoke({
    question: "一句话说明 Output Parser 做什么。"
  });

  console.log("结果类型：", typeof result);
  console.log("结果：", result);
  console.log("\n如果没有 Parser，model.invoke() 返回的是 AIMessage 对象。");
  console.log("StringOutputParser 只是帮你取出 content 字符串。\n");
}

async function runJsonParserDemo() {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `你必须只输出 JSON 对象，不要 Markdown，不要解释。
格式：
{{
  "title": "短标题",
  "summary": "两句以内的摘要",
  "tags": ["标签1", "标签2"]
}}`
    ],
    ["human", "请总结下面这段话：\n{text}"]
  ]);

  const model = createChatModel();
  const parser = new JsonOutputParser<ArticleSummary>();
  const chain = prompt.pipe(model).pipe(parser);

  console.log("========== 2. JsonOutputParser ==========\n");

  // 打断点建议：对比 parser 前后。模型返回的仍是文本，对象是 Parser 造出来的。
  const result = await chain.invoke({
    text: "LangChain 把 Prompt、Model、Parser 都做成 Runnable。可以用 pipe 把它们连成 Chain，少写一些胶水代码。"
  });

  console.log("结果类型：", typeof result);
  console.log("是不是普通对象：", result !== null && typeof result === "object");
  console.log("解析后的对象：");
  console.log(result);
  console.log("\nParser 替换的是你以前手写的 JSON.parse。");
  console.log("它仍然发生在模型调用之后，不会替模型保证字段一定正确。");
}

async function main() {
  try {
    await runStringParserDemo();
    await runJsonParserDemo();
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
