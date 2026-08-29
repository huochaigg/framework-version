import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { createEmbeddings } from "../config/embedding";
import { knowledgeDocuments } from "./knowledge";

export async function createKnowledgeStore() {
  const embeddings = createEmbeddings();
  return MemoryVectorStore.fromDocuments(knowledgeDocuments, embeddings);
}
