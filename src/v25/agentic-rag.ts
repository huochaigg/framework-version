import { HumanMessage } from "@langchain/core/messages";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Annotation, END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createChatModel, printError } from "../config/llm";
import { createEmbeddings } from "../config/embedding";
import { knowledgeDocuments } from "../rag/knowledge";

/**
 * V25 · LangGraph RAG / Agentic RAG
 *
 * LangGraph 对 RAG 的价值不是替我做 embedding。
 * 它是把「判断、检索、生成、分支」组织成可控制的工作流。
 *
 * 普通 RAG：固定 Question → Retrieve → Generate
 * Agentic RAG：Question → Decide → Retrieve 或 Direct → Generate
 *
 * V23 的 Conditional Edge 判断「有没有 Tool Call」。
 * V25 的 Conditional Edge 判断「要不要走 RAG」。
 *
 * 这一版不接 pgvector，不用 Retriever Tool，不做 query rewrite / rerank。
 * Checkpoint 不是重点，每次问题单独 invoke，retrievedDocs 不跨问题复用。
 */

const RagState = Annotation.Root({
  // messages 属于会话历史；本 Demo 每次问题单独 invoke。
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  route: Annotation<"retrieve" | "direct" | undefined>(),
  // retrievedDocs 是当前问题的临时检索结果，生命周期和 messages 不同。
  // 所以用覆盖 reducer：每次检索都替换，不把上一轮文档当成这一轮默认 context。
  retrievedDocs: Annotation<string[]>({
    reducer: (_current, next) => next,
    default: () => []
  })
});

const RouteSchema = z.object({
  route: z
    .enum(["retrieve", "direct"])
    .describe("retrieve 需要查知识库；direct 直接回答")
});

function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

function lastHumanText(state: typeof RagState.State): string {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];

    if (message.getType() === "human") {
      return textFromModel(message.content);
    }
  }

  return "";
}

function lastAiText(state: typeof RagState.State): string {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];

    if (message.getType() === "ai") {
      return textFromModel(message.content);
    }
  }

  return "";
}

function printResult(question: string, routeLabel: string, docCount: number | null, answer: string) {
  console.log(`用户问题：${question}`);
  console.log(`Route：${routeLabel}`);

  if (docCount !== null) {
    console.log(`检索到 ${docCount} 条文档`);
  }

  console.log(`最终回答：${answer}`);
}

async function main() {
  try {
    const embeddings = createEmbeddings();
    // 手写 V17：embedding(docs) → 写入向量库
    const vectorStore = await MemoryVectorStore.fromDocuments(knowledgeDocuments, embeddings);
    const model = createChatModel();
    const router = model.withStructuredOutput(RouteSchema, {
      name: "RagRoute",
      method: "functionCalling"
    });

    const retrieveKnowledge = async (state: typeof RagState.State) => {
      const question = lastHumanText(state);
      // 手写 V17：embedding(question) → vectorSearch() → TopK
      // LangChain：VectorStore.similaritySearch
      const documents = await vectorStore.similaritySearch(question, 3);
      // 打断点 4：看 documents 的 pageContent，不要看 embedding 数组
      return {
        retrievedDocs: documents.map((document) => document.pageContent)
      };
    };

    const generateWithContext = async (state: typeof RagState.State) => {
      const question = lastHumanText(state);
      const context = state.retrievedDocs.join("\n\n");
      // 打断点 5：调模型前观察 question + context
      // 手写 V17：buildContext() → callLLM(context + question)
      const response = await model.invoke(
        `根据下面知识库片段回答问题。只用中文，简短准确。如果片段不够，就说知识库没有覆盖。

知识库片段：
${context}

问题：${question}`
      );

      return { messages: [response] };
    };

    const decideRoute = async (state: typeof RagState.State) => {
      // 打断点 1：刚进入 decideRoute 时的 State，此时还没有 route / retrievedDocs
      const question = lastHumanText(state);
      const decided = await router.invoke(
        `判断这个问题要不要查项目知识库。
当问题涉及 LangChain、LangGraph、Agent、Checkpoint、Tool Calling、RAG、thread_id 等专业内容时选 retrieve。
普通计算、寒暄、常识选 direct。

问题：${question}`
      );
      // 打断点 2：Structured Output 返回 retrieve 或 direct
      return { route: decided.route };
    };

    const directAnswer = async (state: typeof RagState.State) => {
      const question = lastHumanText(state);
      const response = await model.invoke(`用中文简短回答：${question}`);
      return { messages: [response] };
    };

    // 普通 RAG：固定流水线，每个问题都检索。
    const naiveRag = new StateGraph(RagState)
      .addNode("retrieveKnowledge", retrieveKnowledge)
      .addNode("generateWithContext", generateWithContext)
      .addEdge(START, "retrieveKnowledge")
      .addEdge("retrieveKnowledge", "generateWithContext")
      .addEdge("generateWithContext", END)
      .compile();

    const afterDecide = (state: typeof RagState.State) => {
      // 打断点 3：Conditional Edge 根据 route 选下一节点
      return state.route === "retrieve" ? "retrieveKnowledge" : "directAnswer";
    };

    // Agentic RAG：模型先决定走检索还是直接回答。
    const agenticRag = new StateGraph(RagState)
      .addNode("decideRoute", decideRoute)
      .addNode("retrieveKnowledge", retrieveKnowledge)
      .addNode("generateWithContext", generateWithContext)
      .addNode("directAnswer", directAnswer)
      .addEdge(START, "decideRoute")
      .addConditionalEdges("decideRoute", afterDecide)
      .addEdge("retrieveKnowledge", "generateWithContext")
      .addEdge("generateWithContext", END)
      .addEdge("directAnswer", END)
      .compile();

    console.log("=== 普通 RAG ===");
    const naiveQuestion = "LangGraph 的 Checkpoint 有什么作用？";
    const naiveState = await naiveRag.invoke({
      messages: [new HumanMessage(naiveQuestion)]
    });
    printResult(
      naiveQuestion,
      "固定 retrieve（普通 RAG）",
      naiveState.retrievedDocs.length,
      lastAiText(naiveState)
    );

    const agenticQuestions = [
      "LangGraph 的 Checkpoint 有什么作用？",
      "LangChain 和 LangGraph 的职责有什么区别？",
      "100 + 200 等于多少？"
    ];

    for (const question of agenticQuestions) {
      console.log("");
      console.log("=== Agentic RAG ===");
      const result = await agenticRag.invoke({
        messages: [new HumanMessage(question)]
      });
      const usedRetrieve = result.route === "retrieve";
      printResult(
        question,
        result.route ?? "unknown",
        usedRetrieve ? result.retrievedDocs.length : null,
        lastAiText(result)
      );
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();

// 普通 RAG：
//   Question → retrieveKnowledge → VectorStore → retrievedDocs → generateWithContext → END
// Agentic RAG：
//   Question → decideRoute → retrieve → VectorStore → retrievedDocs → generateWithContext → END
//   或 Question → decideRoute → directAnswer → END
