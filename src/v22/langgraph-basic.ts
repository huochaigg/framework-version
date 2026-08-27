import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { createChatModel, printError } from "../config/llm";

/**
 * V22 · LangGraph Fundamentals
 *
 * LangGraph 并不是「另一个大模型框架」。
 * LangChain 更偏组件：Chat Model、Prompt、Tool、Parser。
 * LangGraph 更偏编排：有状态、多步骤、以后还可以分支和循环的工作流。
 *
 * 本文件只学固定顺序的普通 Edge：
 *   START → analyzeQuestion → generateAnswer → END
 *
 * 不做：Conditional Edge、Tool Node、Agent Loop、Checkpoint / Memory。
 */

// ===== State =====
// 手写版：const state = { question, analysis, answer }
// LangGraph：多个 Node 共享的同一份数据。
// 默认没有 reducer 时，Node 返回的字段会覆盖旧值。
//
// 最新文档也推荐 StateSchema + Zod。本仓库 V21 仍是 Zod 3，
// 和 StateSchema 要求的 Standard Schema 对不上，所以用同样稳定的 Annotation.Root。
const GraphState = Annotation.Root({
  question: Annotation<string>(),
  analysis: Annotation<string | undefined>(),
  answer: Annotation<string | undefined>()
});

function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

async function main() {
  try {
    const model = createChatModel();

    // ===== Node =====
    // 手写版：async function analyzeQuestion(state) { ... }
    // LangGraph：读当前 State，只返回要更新的字段。
    const analyzeQuestion = async (state: typeof GraphState.State) => {
      // 打断点：analyzeQuestion 入口，此时应该只有 question
      const response = await model.invoke(
        `你是一名 AI 框架导师。请用两三句话分析下面这个问题：
- 它属于什么类型
- 回答时应该抓住哪一个重点

不要直接给出完整答案。

问题：${state.question}`
      );

      return { analysis: textFromModel(response.content) };
    };

    const generateAnswer = async (state: typeof GraphState.State) => {
      // 打断点：generateAnswer 入口，此时应该已经有 analysis
      const response = await model.invoke(
        `请根据问题分析，用中文、三四段话回答用户问题。抓住职责区别，不要写成教程。

问题：${state.question}

问题分析：${state.analysis ?? "（无）"}`
      );

      return { answer: textFromModel(response.content) };
    };

    // ===== Graph + Edge =====
    // 手写版：await analyze(); await generate();
    // LangGraph：用边把 Node 按固定顺序接起来。
    const graph = new StateGraph(GraphState)
      .addNode("analyzeQuestion", analyzeQuestion)
      .addNode("generateAnswer", generateAnswer)
      .addEdge(START, "analyzeQuestion")
      .addEdge("analyzeQuestion", "generateAnswer")
      .addEdge("generateAnswer", END)
      .compile();

    const initialState = {
      question: "LangGraph 和 LangChain 有什么区别？"
    };

    // 打断点：看 initialState 如何进入 Graph
    const finalState = await graph.invoke(initialState);
    // 打断点：看返回的最终 State，应同时有 question / analysis / answer

    console.log("用户问题：");
    console.log(finalState.question);
    console.log("");
    console.log("问题分析：");
    console.log(finalState.analysis ?? "");
    console.log("");
    console.log("最终回答：");
    console.log(finalState.answer ?? "");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();

// invoke(initialState)
//   → START
//   → analyzeQuestion（读 question，写入 analysis）
//   → generateAnswer（读 question + analysis，写入 answer）
//   → END
//   → 返回最终 State
