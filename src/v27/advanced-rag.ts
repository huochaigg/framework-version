import type { Document } from "@langchain/core/documents";
import { createChatModel, printError } from "../config/llm";
import { generateHypotheticalDocument, shortHypothetical } from "../rag/hyde";
import { generateQueries, retrieveWithQueries } from "../rag/multi-query";
import { documentPreview } from "../rag/preview";
import { formatRerankScores, rerankDocuments, type RankedDocument } from "../rag/rerank";
import { createKnowledgeStore } from "../rag/store";

/**
 * V27 · Advanced RAG Techniques
 *
 * 重点不是 Agent Loop，而是检索质量。
 * 只靠一次向量 TopK 不够：语义相似 ≠ 最适合回答；一种问法也可能漏召回。
 *
 * 对照手写 V17（D:\learn\agent\MyProject\）：
 *   embedQuery(question) → searchSimilarChunks(topK) → buildContext → LLM
 * 这就是 Baseline RAG。V27 在「检索前」和「检索后」加优化，检索阶段本身没变。
 *
 *   检索前：Query Rewrite / Multi Query / HyDE
 *   检索中：Embedding → Vector Search → TopK（手写 searchSimilarChunks / similaritySearch）
 *   检索后：Rerank / 过滤 / Grade
 *   生成：  Context + Question → LLM
 *
 * LangChain 没有神奇改变原理，只是 VectorStore、Document、Structured Output 更好组合。
 * 继续用 V25/V26 的 MemoryVectorStore，不为 V27 换 PostgreSQL。
 */

const BASELINE_TOP_K = 5;
const RERANK_CANDIDATE_K = 10;
const RERANK_FINAL_K = 3;
const MULTI_QUERY_PER_SEARCH_K = 3;
const HYDE_TOP_K = 5;

type ChatModel = ReturnType<typeof createChatModel>;
type KnowledgeStore = Awaited<ReturnType<typeof createKnowledgeStore>>;

type RetrievalStrategy = "baseline" | "rerank" | "multi-query" | "hyde" | "multi-query-rerank";

type RetrievalResult = {
  strategy: RetrievalStrategy;
  question: string;
  retrievalQueries: string[];
  recalledCount: number;
  finalDocuments: Document[];
  hypotheticalDocument?: string;
  vectorTop5?: Document[];
  ranked?: RankedDocument[];
};

// 改这里就能只跑一种策略。默认 all，方便对照。
const STRATEGY: RetrievalStrategy | "all" = "all";

const STRATEGIES: RetrievalStrategy[] = [
  "baseline",
  "rerank",
  "multi-query",
  "hyde",
  "multi-query-rerank"
];

const QUESTIONS = [
  "LangGraph 是怎么记住前面对话，并在下一次调用时恢复状态的？",
  "那个图框架怎么知道我刚才说过什么？"
];

async function retrieveBaseline(vectorStore: KnowledgeStore, question: string): Promise<Document[]> {
  // 打断点 1：Baseline 用原始 question 做 similarity search
  // 手写 V17 searchSimilarChunks() → LangChain VectorStore.similaritySearch
  // 手写 TopK → 这里的 k
  return vectorStore.similaritySearch(question, BASELINE_TOP_K);
}

async function retrieveByStrategy(
  strategy: RetrievalStrategy,
  vectorStore: KnowledgeStore,
  model: ChatModel,
  question: string
): Promise<RetrievalResult> {
  if (strategy === "baseline") {
    const documents = await retrieveBaseline(vectorStore, question);
    return {
      strategy,
      question,
      retrievalQueries: [question],
      recalledCount: documents.length,
      finalDocuments: documents
    };
  }

  if (strategy === "rerank") {
    // Retriever → Candidate Documents → Reranker → Final Documents
    const candidates = await vectorStore.similaritySearch(question, RERANK_CANDIDATE_K);
    const vectorTop5 = candidates.slice(0, BASELINE_TOP_K);
    // 打断点 4：对比 Rerank 前后的 Documents 顺序和 score
    const ranked = await rerankDocuments(model, question, candidates, RERANK_FINAL_K);
    return {
      strategy,
      question,
      retrievalQueries: [question],
      recalledCount: candidates.length,
      finalDocuments: ranked.map((item) => item.document),
      vectorTop5,
      ranked
    };
  }

  if (strategy === "multi-query") {
    // 打断点 2：Multi Query 生成的 3 个 queries
    const queries = await generateQueries(model, question);
    // 打断点 3：三个 Query 分别检索，然后 Merge/Dedupe
    const documents = await retrieveWithQueries(vectorStore, queries, MULTI_QUERY_PER_SEARCH_K);
    return {
      strategy,
      question,
      retrievalQueries: queries,
      recalledCount: documents.length,
      finalDocuments: documents
    };
  }

  if (strategy === "hyde") {
    // 打断点 5：原始 question → hypothetical document
    const hypotheticalDocument = await generateHypotheticalDocument(model, question);
    // 打断点 6：实际传给 VectorStore 的是假设文档，不是原始问题
    const documents = await vectorStore.similaritySearch(hypotheticalDocument, HYDE_TOP_K);
    return {
      strategy,
      question,
      retrievalQueries: [hypotheticalDocument],
      recalledCount: documents.length,
      finalDocuments: documents,
      hypotheticalDocument
    };
  }

  const queries = await generateQueries(model, question);
  const candidates = await retrieveWithQueries(vectorStore, queries, MULTI_QUERY_PER_SEARCH_K);
  const ranked = await rerankDocuments(model, question, candidates, RERANK_FINAL_K);
  return {
    strategy,
    question,
    retrievalQueries: queries,
    recalledCount: candidates.length,
    finalDocuments: ranked.map((item) => item.document),
    ranked
  };
}

async function generateAnswer(model: ChatModel, question: string, documents: Document[]): Promise<string> {
  const context =
    documents.length === 0
      ? "（没有检索到文档）"
      : documents.map((document, index) => `${index + 1}. ${document.pageContent}`).join("\n");

  const response = await model.invoke(
    `根据检索到的真实知识库片段用中文简短回答。
只用这些片段，不要把检索过程中的假设文档或改写 Query 当成事实来源。
片段不够就承认知识库没有覆盖。

知识库片段：
${context}

问题：${question}`
  );

  return typeof response.content === "string" ? response.content.trim() : "";
}

function printDocuments(documents: Document[]): string {
  if (documents.length === 0) {
    return "（无）";
  }

  return documents.map((document) => documentPreview(document)).join(" | ");
}

function printResult(result: RetrievalResult, answer: string) {
  console.log(`Strategy：${result.strategy}`);
  console.log(`原始问题：${result.question}`);

  if (result.strategy === "multi-query" || result.strategy === "multi-query-rerank") {
    console.log(`生成的 Query：${result.retrievalQueries.join(" | ")}`);
  }

  if (result.strategy === "hyde" && result.hypotheticalDocument) {
    console.log(`Hypothetical：${shortHypothetical(result.hypotheticalDocument)}`);
  }

  const retrievalQuery =
    result.strategy === "hyde" && result.hypotheticalDocument
      ? shortHypothetical(result.hypotheticalDocument)
      : result.retrievalQueries.join(" | ");
  console.log(`实际检索 Query：${retrievalQuery}`);
  console.log(`召回文档数量：${result.recalledCount}`);

  if (result.vectorTop5) {
    console.log(`Vector Top5：${printDocuments(result.vectorTop5)}`);
  }

  if (result.ranked) {
    console.log(`Rerank：${formatRerankScores(result.ranked)}`);
  }

  console.log(`最终 Documents：${printDocuments(result.finalDocuments)}`);
  console.log(`最终回答：${answer}`);
}

async function main() {
  try {
    const vectorStore = await createKnowledgeStore();
    const model = createChatModel();
    const strategies = STRATEGY === "all" ? STRATEGIES : [STRATEGY];

    for (const [questionIndex, question] of QUESTIONS.entries()) {
      for (const [strategyIndex, strategy] of strategies.entries()) {
        if (questionIndex > 0 || strategyIndex > 0) {
          console.log("");
        }

        const retrieved = await retrieveByStrategy(strategy, vectorStore, model, question);
        const answer = await generateAnswer(model, question, retrieved.finalDocuments);
        printResult(retrieved, answer);
      }
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();

// baseline:          Question → similaritySearch Top5 → Generate
// rerank:            Question → Top10 → Rerank Top3 → Generate
// multi-query:       Question → 3 Queries → 多次 Retrieve → Merge/Dedupe → Generate
// hyde:              Question → Hypothetical Document → similaritySearch → Generate
// multi-query-rerank: Question → Multi Query → Merge/Dedupe → Rerank → Generate


/** 
Strategy：baseline
原始问题：LangGraph 是怎么记住前面对话，并在下一次调用时恢复状态的？
召回文档数量：5
召回文档数量：5
召回文档数量：5
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | LangGraph 职责：LangGraph 负责有状态工作流编排。它用 State、Node、Edge  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | thread_id：thread_id 用于区分不同 Graph 会话。同一个 thread_id  | Agent Loop：Agent Loop 是 Model → Tool → Model 的循环。有
最终回答：LangGraph 通过 `thread_id` 和 checkpointer 记住前面对话。同一个 `thread_id` 会恢复之前保存的 State（整份状态快照，不 只是聊天记录），从而继续之前的对话；新的 `thread_id` 则从空状态开始。不同 `thread_id` 的状态互相隔离。

Strategy：rerank
原始问题：那个图框架怎么知道我刚才说过什么？
实际检索 Query：那个图框架怎么知道我刚才说过什么？
召回文档数量：9
Vector Top5：Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | thread_id：thread_id 用于区分不同 Graph 会话。同一个 thread_id  | Agent Loop：Agent Loop 是 Model → Tool → Model 的循环。有  | RAG：RAG 是先检索外部知识再提供给模型。普通 RAG 固 定走 Question → | Tool Calling：Tool Calling 是模型输出工具调用请求。模型只提出要调用哪个工具和什么
Rerank：Checkpointer restore 95；thread_id 85；Checkpoint 70
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | thread_id：thread_id 用于区分不同 Graph 会话。 同一个 thread_id  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的
最终回答：框架通过 `thread_id` 和检查点（checkpointer）来知道你说过什么。同一个 `thread_id` 会从检查点恢复之前保存的完整状态（包括聊天记录），所以能继续之前的对话；新的 `thread_id` 则从空状态开始。注意，`thread_id` 不是用户ID，它只是区分不同会话的标识。
Strategy：multi-query
原始问题：LangGraph 是怎么记住前面对话，并在下一次调用时恢复状态的？
生成的 Query：LangGraph conversation memory state restore | LangGraph checkpointer thread_id persistence | LangGraph 对话记忆 状态恢复 机制
实际检索 Query：LangGraph conversation memory state restore | LangGraph checkpointer thread_id persistence | LangGraph 对话记忆 状态恢复 机制
召回文档数量：5
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | LangGraph 职责：LangGraph 负责有状态工作流编排 。它用 State、Node、Edge  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | MemorySaver：MemorySaver 是内存 Checkpointer。进程重启后数据会丢失。 | thread_id：thread_id 用于区分不同 Graph 会话。同一个 thread_id
最终回答：LangGraph 通过 `thread_id` 和 checkpointer 来记住前面对话。同一个 `thread_id` 会通过 checkpointer 重新加载已保存的消息，从而继续之前的对话；新的 `thread_id` 则从空状态开始。Checkpoint 保存的是整个 Graph State 的快照，不只是聊天记录。

Strategy：hyde
原始问题：LangGraph 是怎么记住前面对话，并在下一次调用时恢复状态的？
Hypothetical：LangGraph 通过 checkpointer 机制持久化 graph state，每个会话使用唯一的 thread_id 标识。在每次节点执行后，checkpointer 会将当前 graph state 保存到存储后端（如内存、SQ
实际检索 Query：LangGraph 通过 checkpointer 机制持久化 graph state，每个会话使用唯一的 thread_id 标识。在每次节点执行后，checkpointer 会将当前 graph state 保存到存储后端（如内存、SQ
召回文档数量：5
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | LangGraph 职责：LangGraph 负责有状态工作流编排。它用 State、Node、Edge  | thread_id：thread_id 用于区分不同 Graph 会话。同一个 thread_id  | MemorySaver：MemorySaver 是内存 Checkpointer。进程重启后数据会丢失。
最终回答：LangGraph 通过 `thread_id` 配合 Checkpointer 来记住并恢复对话状态。同一个 `thread_id` 会从 Checkpointer 重新加载之前保存的 State（整份状态快照，不只是聊天记录），从而继续之前的对话；新的 `thread_id` 则从空状态开始。不同 `thread_id` 的状态互相隔离。

Strategy：multi-query-rerank
原始问题：LangGraph 是怎么记住前面对话，并在下一次调用时恢复状态的？
生成的 Query：LangGraph 对话记忆 状态恢复 | LangGraph checkpointer state persistence | LangGraph thread_id restore conversation history
实际检索 Query：LangGraph 对话记忆 状态恢复 | LangGraph checkpointer state persistence | LangGraph thread_id restore conversation history
召回文档数量：5
Rerank：Checkpointer restore 95；thread_id 75；Checkpoint 70
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | thread_id：thread_id 用于区分不同 Graph 会话。 同一个 thread_id  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的
最终回答：LangGraph 通过 `thread_id` 和 checkpointer 记住前面对话。同一个 `thread_id` 会恢复之前保存的 State（整份状态快照，不只是聊天记录），从而继续之前的对话；新的 `thread_id` 则从空状态开始。

Strategy：baseline
原始问题：那个图框架怎么知道我刚才说过什么？
实际检索 Query：那个图框架怎么知道我刚才说过什么？
召回文档数量：5
最终 Documents：Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | thread_id：thread_id 用于区分不同 Graph 会话。 同一个 thread_id  | Agent Loop：Agent Loop 是 Model → Tool → Model 的循环。有  | RAG：RAG 是先检索外部知识再提供给模型。普通 RAG 固定走 Question → | Tool Calling：Tool Calling 是模型输出工具调用请求。模型只提出要调用哪个工具和什么
最终回答：图框架通过 **Checkpoint** 保存 **Graph State** 来知道你说过什么。State 是整份快照，不只是聊天记录。它用 **thread_id** 区分不同会话：同一个 thread_id 会恢复之前保存的 State，不同 thread_id 的状态互相隔离。

Strategy：rerank
原始问题：那个图框架怎么知道我刚才说过什么？
实际检索 Query：那个图框架怎么知道我刚才说过什么？
召回文档数量：9
Vector Top5：Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | thread_id：thread_id 用于区分不同 Graph 会话。同一个 thread_id  | Agent Loop：Agent Loop 是 Model → Tool → Model 的循环。有  | RAG：RAG 是先检索外部知识再提供给模型。普通 RAG 固 定走 Question → | Tool Calling：Tool Calling 是模型输出工具调用请求。模型只提出要调用哪个工具和什么
Rerank：Checkpointer restore 95；thread_id 85；Checkpoint 70
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | thread_id：thread_id 用于区分不同 Graph 会话。 同一个 thread_id  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的
最终回答：框架通过 `thread_id` 和检查点（checkpointer）来知道你说过什么。同一个 `thread_id` 会从检查点恢复之前保存的完整状态（包括聊天记录），所以能继续之前的对话；新的 `thread_id` 则从空状态开始。注意，`thread_id` 不是用户ID，它只是区分不同会话的标识。   

Strategy：multi-query
原始问题：那个图框架怎么知道我刚才说过什么？
生成的 Query：LangGraph 对话记忆 状态持久化 | LangGraph conversation memory state | LangGraph checkpointer thread_id 恢复消息   
实际检索 Query：LangGraph 对话记忆 状态持久化 | LangGraph conversation memory state | LangGraph checkpointer thread_id 恢复消息 
召回文档数量：4
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | LangGraph 职责：LangGraph 负责有状态工作流编排 。它用 State、Node、Edge  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | thread_id：thread_id 用于区分不同 Graph 会话。同一个 thread_id
最终回答：LangGraph 通过 `thread_id` 和 checkpointer 来恢复之前的对话状态。同一个 `thread_id` 会从 checkpointer 重新加载已保存的消息，从而继续之前的对话；新的 `thread_id` 则从空状态开始。

Strategy：hyde
原始问题：那个图框架怎么知道我刚才说过什么？
Hypothetical：The graph framework maintains conversational context through a checkpointer that persists the graph state across invocat
实际检索 Query：The graph framework maintains conversational context through a checkpointer that persists the graph state across invocat
召回文档数量：5
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | thread_id：thread_id 用于区分不同 Graph 会话。 同一个 thread_id  | LangGraph 职责：LangGraph 负责有状态工作流编排。它用 State、Node、Edge  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的 | Agent Loop：Agent Loop 是 Model → Tool → Model 的循环。有
最终回答：LangGraph 通过 `thread_id` 和 checkpointer 来记住对话内容。同一个 `thread_id` 会恢复之前保存的 State（包括消息），所以能继续之前的对话；新的 `thread_id` 则从空状态开始。Checkpoint 保存的是整份 State 的快照，不只是聊天记录。

Strategy：multi-query-rerank
原始问题：那个图框架怎么知道我刚才说过什么？
生成的 Query：LangGraph 对话记忆 状态持久化 | LangGraph conversation memory state | LangGraph checkpointer thread_id 恢复消息   
实际检索 Query：LangGraph 对话记忆 状态持久化 | LangGraph conversation memory state | LangGraph checkpointer thread_id 恢复消息 
召回文档数量：4
Rerank：Checkpointer restore 95；thread_id 85；Checkpoint 60
最终 Documents：Checkpointer restore：LangGraph uses thread_id together with a | thread_id：thread_id 用于区分不同 Graph 会话。 同一个 thread_id  | Checkpoint：Checkpoint 可以保存 Graph State。它是整份 State 的
最终回答：框架通过 `thread_id` 和检查点（checkpointer）来知道你说过什么。同一个 `thread_id` 会从检查点恢复之前保存的完整状态（包括聊天记录），所以能继续之前的对话；新 `thread_id` 则从空状态开始。注意 `thread_id` 不是用户ID，它只是区分不同会话的标识。      
*/








