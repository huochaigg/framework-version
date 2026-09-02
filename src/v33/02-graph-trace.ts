import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { createChatModel, printError } from "../config/llm";
import {
  projectHint,
  requireLangSmithConfig,
  textFromModel,
  traceConfig
} from "./shared";

/**
 * V33-2 · Trace 是一棵树，不是一行日志
 *
 * START → analyze → answer → END
 *
 * LangSmith 里应能看到：
 *   Graph Run
 *     → analyze Node → Model Run
 *     → answer Node → Model Run
 *
 * Trace → Run → Child Run。
 * 打断点：analyze / answer 进入和退出。
 */

const GraphState = Annotation.Root({
  question: Annotation<string>(),
  analysis: Annotation<string | undefined>(),
  finalAnswer: Annotation<string | undefined>()
});

async function main() {
  requireLangSmithConfig();
  const model = createChatModel();

  const analyze = async (state: typeof GraphState.State) => {
    const response = await model.invoke(
      `用一两句话分析这个问题要抓住什么重点，不要直接给完整答案。\n\n问题：${state.question}`
    );
    return { analysis: textFromModel(response.content) };
  };

  const answer = async (state: typeof GraphState.State) => {
    const response = await model.invoke(
      `根据问题分析，用中文两三句话回答。不要写成教程。\n\n问题：${state.question}\n问题分析：${state.analysis ?? "（无）"}`
    );
    return { finalAnswer: textFromModel(response.content) };
  };

  const graph = new StateGraph(GraphState)
    .addNode("analyze", analyze)
    .addNode("answer", answer)
    .addEdge(START, "analyze")
    .addEdge("analyze", "answer")
    .addEdge("answer", END)
    .compile();

  const result = await graph.invoke(
    { question: "简单解释一下 LangGraph。" },
    traceConfig("v33-simple-graph", {
      tags: ["graph"],
      metadata: { feature: "graph-trace" }
    })
  );

  console.log(result.finalAnswer ?? "");
  console.log(`\n去 LangSmith 看 Graph → Node → Model 的父子关系。Project：${projectHint()}`);
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
