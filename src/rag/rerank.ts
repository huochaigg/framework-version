import type { Document } from "@langchain/core/documents";
import { z } from "zod";
import { createChatModel } from "../config/llm";
import { documentPreview, documentTitle } from "./preview";

type ChatModel = ReturnType<typeof createChatModel>;

export type RankedDocument = {
  document: Document;
  score: number;
};

/**
 * LLM Rerank。
 *
 * 手写版如果自己做二次排序，大概就是：
 *   vectorSearch(topK=10) → scoreDocuments(question, docs) → sort → slice(0, 3)
 *
 * 手写 V17 的 searchSimilarChunks() 只按 embedding <=> 距离排序，那是「语义相似度」。
 * 语义相似 ≠ 最适合回答当前问题。Rerank 是检索后的精排，不是再做一次向量检索。
 *
 * LangChain 没有改变底层原理，只是 Document + Structured Output 让这套流程更好组合。
 * 这一版用 LLM 打 0～100 分，不接 Cohere / Jina 等专门 Rerank API。
 */
const RerankSchema = z.object({
  scores: z
    .array(
      z.object({
        index: z.number().int().describe("文档编号，从 0 开始"),
        score: z.number().min(0).max(100).describe("对回答该问题有多有价值，0～100")
      })
    )
    .describe("每个候选文档的相关性分数。只打分，不要生成答案")
});

export async function rerankDocuments(
  model: ChatModel,
  question: string,
  documents: Document[],
  topK: number
): Promise<RankedDocument[]> {
  if (documents.length === 0) {
    return [];
  }

  const reranker = model.withStructuredOutput(RerankSchema, {
    name: "DocumentRerank",
    method: "functionCalling"
  });

  const listed = documents
    .map((document, index) => `[${index}] ${documentPreview(document)}\n${document.pageContent}`)
    .join("\n\n");

  const ranked = await reranker.invoke(
    `判断下面每篇文档对回答用户问题有多有价值。
只给相关性分数，不要生成答案，不要改写文档。
向量相似不等于一定能回答问题。请按「有没有回答所需事实」打分。

用户问题：${question}

候选文档：
${listed}`
  );

  const scoreByIndex = new Map(ranked.scores.map((item) => [item.index, item.score]));

  return documents
    .map((document, index) => ({
      document,
      score: scoreByIndex.get(index) ?? 0
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export function formatRerankScores(ranked: RankedDocument[]): string {
  return ranked
    .map((item) => `${documentTitle(item.document)} ${item.score}`)
    .join("；");
}
