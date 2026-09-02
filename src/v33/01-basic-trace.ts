import { HumanMessage } from "@langchain/core/messages";
import { createChatModel, printError } from "../config/llm";
import {
  projectHint,
  requireLangSmithConfig,
  textFromModel,
  traceConfig
} from "./shared";

/**
 * V33-1 · 一次 model.invoke = 一条可追踪的 Run
 *
 * 不要写复杂 callback。环境变量打开 tracing 即可。
 *
 * 到 LangSmith UI 重点看：
 * 输入 messages、模型名称、输出 AIMessage、开始/结束时间、耗时、Token Usage。
 *
 * 打断点：model.invoke 前后。
 */

async function main() {
  requireLangSmithConfig();

  const model = createChatModel();
  const response = await model.invoke(
    [new HumanMessage("简单解释一下 LangGraph。")],
    traceConfig("v33-basic-chat", { tags: ["chat"], metadata: { feature: "basic-trace" } })
  );

  console.log(textFromModel(response.content));
  console.log(`\n去 LangSmith 看这一次 Model Run。Project：${projectHint()}`);
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
