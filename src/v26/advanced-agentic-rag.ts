import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import { z } from "zod";
import { createChatModel, printError } from "../config/llm";
import { createKnowledgeStore } from "../rag/store";

/**
 * V26 · Advanced Agentic RAG
 *
 * V25 只有分支：要不要检索。
 * V26 出现判断 + 回退 + 循环：检索结果有没有用 → 没用就改写 Query → 再检索。
 *
 * 手写版可能是：
 *   while (docsNotRelevant && rewriteCount < max) {
 *     query = rewrite(query);
 *     docs = search(query);
 *   }
 *
 * LangGraph 用 Node + Conditional Edge + 回边表达这个循环，Graph 外面没有 while。
 *
 * similarity score ≠ 文档一定有用。向量距离只说明语义相近，
 * 不能保证文档真包含回答当前问题所需的信息。
 * Retriever 负责「找相似」；Grader 负责「这些内容能不能回答问题」。
 */

const MAX_REWRITES = 2;

const AdvancedRagState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  route: Annotation<"retrieve" | "direct" | undefined>(),
  query: Annotation<string>(),
  retrievedDocs: Annotation<string[]>({
    reducer: (_current, next) => next,
    default: () => []
  }),
  relevance: Annotation<"relevant" | "irrelevant" | undefined>(),
  rewriteCount: Annotation<number>({
    reducer: (_current, next) => next,
    default: () => 0
  })
});

const RouteSchema = z.object({
  route: z.enum(["retrieve", "direct"]).describe("retrieve 查知识库；direct 直接回答")
});

const GradeSchema = z.object({
  relevance: z
    .enum(["relevant", "irrelevant"])
    .describe("retrievedDocs 是否包含足够信息回答原始问题")
});

const RewriteSchema = z.object({
  query: z.string().describe("更适合向量检索的短 query，不要解释")
});

function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

function lastHumanText(state: typeof AdvancedRagState.State): string {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];

    if (message.getType() === "human") {
      return textFromModel(message.content);
    }
  }

  return "";
}

function lastAiText(state: typeof AdvancedRagState.State): string {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];

    if (message.getType() === "ai") {
      return textFromModel(message.content);
    }
  }

  return "";
}

function printResult(question: string, state: typeof AdvancedRagState.State) {
  console.log(`用户问题：${question}`);
  console.log(`Route：${state.route ?? "unknown"}`);

  if (state.route !== "direct") {
    console.log(`Query：${state.query}`);
    console.log(`检索到 ${state.retrievedDocs.length} 条文档`);
    console.log(`Grade：${state.relevance ?? "none"}`);

    if (state.rewriteCount > 0) {
      console.log(`Rewrite 次数：${state.rewriteCount}`);
      console.log(`改写后 Query：${state.query}`);
    }
  }

  console.log(`最终回答：${lastAiText(state)}`);
}

async function main() {
  try {
    const vectorStore = await createKnowledgeStore();
    const model = createChatModel();
    const router = model.withStructuredOutput(RouteSchema, {
      name: "RagRoute",
      method: "functionCalling"
    });
    const grader = model.withStructuredOutput(GradeSchema, {
      name: "DocGrade",
      method: "functionCalling"
    });
    const rewriter = model.withStructuredOutput(RewriteSchema, {
      name: "QueryRewrite",
      method: "functionCalling"
    });

    const decideRoute = async (state: typeof AdvancedRagState.State) => {
      const question = lastHumanText(state);
      const decided = await router.invoke(
        `判断这个问题要不要查项目知识库。
当问题涉及 LangChain、LangGraph、Agent、Checkpoint、Tool Calling、RAG、thread_id、图框架如何记住对话等专业内容时选 retrieve。
明确要求基于知识库回答时也选 retrieve。
普通计算、寒暄、常识选 direct。

问题：${question}`
      );

      return { route: decided.route };
    };

    const retrieveKnowledge = async (state: typeof AdvancedRagState.State) => {
      // 打断点 1 / 5：用当前 query 检索，Rewrite 之后这里应是新 query，不是原始口语问题
      const documents = await vectorStore.similaritySearch(state.query, 3);
      // 打断点 2：看 retrievedDocs 的文本，不要看 embedding
      return {
        retrievedDocs: documents.map((document) => document.pageContent)
      };
    };

    const gradeDocuments = async (state: typeof AdvancedRagState.State) => {
      const question = lastHumanText(state);
      const graded = await grader.invoke(
        `判断这些检索文档是否包含足够信息，能够回答用户的原始问题。
向量相似不等于一定有用。只有文档真正覆盖问题所需事实时才选 relevant。

原始问题：${question}
当前检索 query：${state.query}
检索文档：
${state.retrievedDocs.join("\n---\n")}`
      );
      // 打断点 3：relevance 只能是 relevant / irrelevant
      return { relevance: graded.relevance };
    };

    const rewriteQuery = async (state: typeof AdvancedRagState.State) => {
      const question = lastHumanText(state);
      const rewritten = await rewriter.invoke(
        `把当前检索 query 改写成更适合向量检索的短 query。
用户原问题可能口语化、有代词和省略。检索更喜欢明确的术语。
只返回短 query，不要解释。可以保留 LangGraph、checkpoint、thread_id、memory 这类关键词。

原始问题：${question}
当前 query：${state.query}`
      );
      // 打断点 4：对比改写前后的 query
      return {
        query: rewritten.query,
        rewriteCount: state.rewriteCount + 1
      };
    };

    const generateWithContext = async (state: typeof AdvancedRagState.State) => {
      const question = lastHumanText(state);
      const response = await model.invoke(
        `根据知识库片段用中文简短回答原始问题。如果片段不够，要承认知识库不足，不要编造库里有某条内容。

知识库片段：
${state.retrievedDocs.join("\n\n")}

原始问题：${question}`
      );

      return { messages: [response] };
    };

    const fallbackAnswer = async (state: typeof AdvancedRagState.State) => {
      const question = lastHumanText(state);
      const response = await model.invoke(
        `当前知识库检索后仍没有足够信息。请明确告诉用户：知识库无法充分回答。
可以基于模型自身知识谨慎补充，但必须先承认知识库不足，不要假装片段里有答案。

原始问题：${question}`
      );

      return { messages: [response] };
    };

    const directAnswer = async (state: typeof AdvancedRagState.State) => {
      const question = lastHumanText(state);
      const response = await model.invoke(`用中文简短回答：${question}`);
      return { messages: [response] };
    };

    const afterDecide = (state: typeof AdvancedRagState.State) => {
      return state.route === "retrieve" ? "retrieveKnowledge" : "directAnswer";
    };

    const afterGrade = (state: typeof AdvancedRagState.State) => {
      if (state.relevance === "relevant") {
        return "generateWithContext";
      }

      // 打断点 6：rewriteCount 已到上限时走 fallback，不再 rewrite
      if (state.rewriteCount >= MAX_REWRITES) {
        return "fallbackAnswer";
      }

      return "rewriteQuery";
    };

    const graph = new StateGraph(AdvancedRagState)
      .addNode("decideRoute", decideRoute)
      .addNode("retrieveKnowledge", retrieveKnowledge)
      .addNode("gradeDocuments", gradeDocuments)
      .addNode("rewriteQuery", rewriteQuery)
      .addNode("generateWithContext", generateWithContext)
      .addNode("fallbackAnswer", fallbackAnswer)
      .addNode("directAnswer", directAnswer)
      .addEdge(START, "decideRoute")
      .addConditionalEdges("decideRoute", afterDecide)
      .addEdge("retrieveKnowledge", "gradeDocuments")
      .addConditionalEdges("gradeDocuments", afterGrade)
      .addEdge("rewriteQuery", "retrieveKnowledge")
      .addEdge("generateWithContext", END)
      .addEdge("fallbackAnswer", END)
      .addEdge("directAnswer", END)
      .compile();

    const questions = [
      "LangGraph 的 Checkpoint 是怎么让 Agent 保留多轮对话的？",
      "那个图框架是怎么记住我上一句话的？",
      "请只根据当前知识库回答：量子计算里的 Shor 算法是什么？"
    ];

    for (const [index, question] of questions.entries()) {
      if (index > 0) {
        console.log("");
      }

      console.log(`=== ${question} ===`);
      const result = await graph.invoke({
        messages: [new HumanMessage(question)],
        query: question,
        rewriteCount: 0
      });
      printResult(question, result);
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();

// Question → decideRoute
//   → directAnswer → END
//   → retrieveKnowledge → gradeDocuments
//       → relevant → generateWithContext → END
//       → irrelevant 且还能改写 → rewriteQuery → retrieveKnowledge
//       → irrelevant 且 rewriteCount 已到上限 → fallbackAnswer → END
