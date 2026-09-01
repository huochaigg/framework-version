import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { createEmbeddings } from "../../config/embedding";
import { layerError } from "../config";
import { knowledgeDocuments } from "./documents";

/**
 * V32 继续用 MemoryVectorStore。
 * 手写 V17 已经实践过 PostgreSQL + pgvector；要换真实向量库，只改这一层。
 * 百炼 embedding 单次 batch 不能超过 10 条，所以分批写入。
 */
export async function createKnowledgeStore() {
  try {
    const embeddings = createEmbeddings();
    const store = new MemoryVectorStore(embeddings);
    const batchSize = 10;

    for (let index = 0; index < knowledgeDocuments.length; index += batchSize) {
      await store.addDocuments(
        knowledgeDocuments.slice(index, index + batchSize)
      );
    }

    return store;
  } catch (error) {
    throw layerError("Vector store init failed", error);
  }
}
