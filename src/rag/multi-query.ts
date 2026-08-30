import type { Document } from "@langchain/core/documents";
import { z } from "zod";
import { createChatModel } from "../config/llm";
import { documentId } from "./preview";
import type { createKnowledgeStore } from "./store";

type ChatModel = ReturnType<typeof createChatModel>;
type KnowledgeStore = Awaited<ReturnType<typeof createKnowledgeStore>>;

/**
 * Multi Query：一个问题变成多个检索 Query。
 *
 * 用户只有一种说法，知识库里同一概念可能有多种说法。
 * 只拿原始 question 做一次 embedding，可能漏掉相关文档。这是「召回不足」。
 *
 * Multi Query 提高 Recall；Rerank 提高 Precision。两者不是一回事。
 *
 * 手写版对应：
 *   queries = llm.generateQueries(question, n=3)
 *   docs = queries.flatMap(q => searchSimilarChunks(embed(q), topK=3))
 *   unique(docs)
 */
const QueriesSchema = z.object({
  queries: z
    .array(z.string())
    .length(3)
    .describe("3 个不同角度的短检索 Query，不要解释")
});

export async function generateQueries(model: ChatModel, question: string): Promise<string[]> {
  const generator = model.withStructuredOutput(QueriesSchema, {
    name: "MultiQuery",
    method: "functionCalling"
  });

  const generated = await generator.invoke(
    `根据用户问题生成 3 个不同角度的向量检索 Query。
覆盖：中文术语、英文术语、实现细节关键词。
每个 Query 要短，适合 embedding 检索，不要编号，不要解释。
例如原问题「LangGraph 怎么记住之前的聊天？」可以生成：
LangGraph conversation memory
LangGraph checkpointer state persistence
LangGraph thread_id restore messages

用户问题：${question}`
  );

  return generated.queries;
}

export function mergeAndDedupe(groups: Document[][]): Document[] {
  const seen = new Set<string>();
  const merged: Document[] = [];

  for (const documents of groups) {
    for (const document of documents) {
      const key = documentId(document);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(document);
    }
  }

  return merged;
}

export async function retrieveWithQueries(
  vectorStore: KnowledgeStore,
  queries: string[],
  perQueryK: number
): Promise<Document[]> {
  const groups: Document[][] = [];

  for (const query of queries) {
    groups.push(await vectorStore.similaritySearch(query, perQueryK));
  }

  return mergeAndDedupe(groups);
}
