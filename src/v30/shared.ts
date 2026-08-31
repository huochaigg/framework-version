import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { createChatModel } from "../config/llm";

/**
 * V30 共用的极简 Graph。
 * 不接 Tool、RAG、人工审批、Checkpointer。只观察 Streaming。
 *
 * START → analyze → generateAnswer → END
 *
 * Node 名不能和 State 字段同名。State 有 answer 字段，所以节点叫 generateAnswer。
 */
export const GraphState = Annotation.Root({
  question: Annotation<string>(),
  analysis: Annotation<string | undefined>(),
  answer: Annotation<string | undefined>()
});

export type GraphStateType = typeof GraphState.State;

export const DEMO_QUESTION = "LangGraph 和 LangChain 有什么区别？";

export function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

export function shortText(value: string | undefined, max = 40): string {
  if (!value) {
    return "（无）";
  }

  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

export function createAnalyzeAnswerGraph() {
  const model = createChatModel();

  const analyze = async (state: GraphStateType) => {
    const response = await model.invoke(
      `用一两句话分析这个问题要抓住什么重点，不要直接给完整答案。

问题：${state.question}`
    );

    return { analysis: textFromModel(response.content).trim() };
  };

  const generateAnswer = async (state: GraphStateType) => {
    const response = await model.invoke(
      `根据问题分析，用中文两三句话回答。不要写成教程。

问题：${state.question}
问题分析：${state.analysis ?? "（无）"}`
    );

    return { answer: textFromModel(response.content).trim() };
  };

  return new StateGraph(GraphState)
    .addNode("analyze", analyze)
    .addNode("generateAnswer", generateAnswer)
    .addEdge(START, "analyze")
    .addEdge("analyze", "generateAnswer")
    .addEdge("generateAnswer", END)
    .compile();
}

export function createCallModelGraph() {
  const model = createChatModel();

  const callModel = async (state: GraphStateType) => {
    const response = await model.invoke(`用一两句话解释：${state.question}`);
    return { answer: textFromModel(response.content).trim() };
  };

  return new StateGraph(GraphState)
    .addNode("callModel", callModel)
    .addEdge(START, "callModel")
    .addEdge("callModel", END)
    .compile();
}
