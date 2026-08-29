import "dotenv/config";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Embedding 和 Chat 不是同一个模型。
 * 手写 V17：OpenAI SDK embeddings.create({ model, input, dimensions })
 * LangChain：OpenAIEmbeddings.embedQuery / embedDocuments
 * 底层仍是 OpenAI Compatible HTTP。
 */
export function createEmbeddings() {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const baseURL = process.env.EMBEDDING_BASE_URL;
  const model = process.env.EMBEDDING_MODEL;
  const dimensionsText = process.env.EMBEDDING_DIMENSIONS;

  if (!apiKey) {
    throw new Error("缺少 EMBEDDING_API_KEY。Chat 和 Embedding 请分开配置。");
  }

  if (!baseURL) {
    throw new Error("缺少 EMBEDDING_BASE_URL。例如百炼：https://dashscope.aliyuncs.com/compatible-mode/v1");
  }

  if (!model) {
    throw new Error("缺少 EMBEDDING_MODEL。例如 text-embedding-v4");
  }

  const dimensions = dimensionsText ? Number(dimensionsText) : undefined;

  if (dimensionsText && Number.isNaN(dimensions)) {
    throw new Error("EMBEDDING_DIMENSIONS 必须是数字");
  }

  return new OpenAIEmbeddings({
    model,
    apiKey,
    dimensions,
    configuration: {
      baseURL
    }
  });
}
