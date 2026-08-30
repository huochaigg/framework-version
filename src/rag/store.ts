import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { createEmbeddings } from "../config/embedding";
import { knowledgeDocuments } from "./knowledge";

/** V25 / V26 / V27 共用这一份内存向量库，不要为新版本再复制一份知识库初始化。 */
export async function createKnowledgeStore() {
  const embeddings = createEmbeddings();
  return MemoryVectorStore.fromDocuments(knowledgeDocuments, embeddings);
}
