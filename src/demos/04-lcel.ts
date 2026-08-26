import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createChatModel, printError } from "../config/llm";

/**
 * Demo 4：LCEL（LangChain Expression Language）
 *
 * 这是 V21 的重点。
 *
 * 手写版本大概是三个函数串起来：
 *   buildPrompt()  →  callLLM()  →  parseResult()
 *
 * LangChain 把每一步都做成 Runnable，再用 pipe 连成 Chain：
 *   prompt.pipe(model).pipe(parser)
 *
 * Runnable 的共同点：都有 invoke()。
 * pipe 的含义：上一步的输出，自动变成下一步的输入。
 *
 * 本 Demo 故意先拆开跑一遍，再 pipe 一次，方便对照。
 */
async function runStepByStep() {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一名简洁的中文讲师。只用两三句话回答。"],
    ["human", "{question}"]
  ]);
  const model = createChatModel();
  const parser = new StringOutputParser();
  const input = { question: "LCEL 是什么？请用初学者能懂的话解释。" };

  console.log("========== 拆开看：buildPrompt → callLLM → parseResult ==========\n");

  // 1. 以前的 buildPrompt()
  const promptValue = await prompt.invoke(input);
  console.log("① Prompt 输出（ChatPromptValue / Messages）：");
  console.log(promptValue.toChatMessages().map((message) => `[${message.getType()}] ${message.content}`).join("\n"));
  console.log("");

  // 2. 以前的 callLLM()
  const aiMessage = await model.invoke(promptValue);
  console.log("② Model 输出（AIMessage 对象，不只是 string）：");
  console.log("类型：", aiMessage.constructor.name);
  console.log("content：", aiMessage.content);
  console.log("");

  // 3. 以前的 parseResult()
  const text = await parser.invoke(aiMessage);
  console.log("③ Parser 输出（纯 string）：");
  console.log(text);
  console.log("");
}

async function runPipedChain() {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一名简洁的中文讲师。只用两三句话回答。"],
    ["human", "{question}"]
  ]);
  const model = createChatModel();
  const parser = new StringOutputParser();

  // ===== V21 学习重点 =====
  //
  // chain 不是新的魔法对象，只是把三个 Runnable 接起来。
  // chain.invoke({ question }) 内部仍然依次做：
  //   prompt.invoke → model.invoke → parser.invoke
  //
  // ========================
  const chain = prompt.pipe(model).pipe(parser);

  console.log("========== 用 pipe 接起来：prompt → model → parser ==========\n");
  console.log("写法：prompt.pipe(model).pipe(parser)");
  console.log("输入：{ question: 'LCEL 是什么？...' }\n");

  // 打断点建议：停在 chain.invoke，Step Into 观察数据如何沿 pipe 流动
  const result = await chain.invoke({
    question: "LCEL 是什么？请用初学者能懂的话解释。"
  });

  console.log("Chain 最终输出（已经是 string）：\n");
  console.log(result);
  console.log("\n以后在 LangGraph / Agent 里，节点之间传数据，仍然建立在 Runnable 这套接口上。");
  console.log("本版本到 Chain 为止，不要把 pipe 理解成 Agent Loop。");
}

async function main() {
  try {
    await runStepByStep();
    await runPipedChain();
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
