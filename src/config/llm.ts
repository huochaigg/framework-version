import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

/**
 * 统一创建 Chat Model。
 *
 * 手写项目 V1：
 *   new OpenAI({ apiKey, baseURL })
 *   client.chat.completions.create({ model, messages })
 *
 * LangChain：
 *   new ChatOpenAI({ model, apiKey, configuration: { baseURL } })
 *   model.invoke(...) / model.stream(...)
 *
 * ChatOpenAI 底层仍然走 OpenAI Compatible HTTP 接口。
 * 换 DeepSeek / 百炼，改的是环境变量，不是换一套新概念。
 */
export function createChatModel() {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  const modelName = process.env.LLM_MODEL;

  if (!apiKey) {
    throw new Error("缺少 LLM_API_KEY。请复制 .env.example 为 .env 并填入真实 Key。");
  }

  if (!baseURL) {
    throw new Error("缺少 LLM_BASE_URL。例如 DeepSeek 填 https://api.deepseek.com");
  }

  if (!modelName) {
    throw new Error("缺少 LLM_MODEL。例如 DeepSeek 填 deepseek-chat");
  }

  return new ChatOpenAI({
    model: modelName,
    apiKey,
    temperature: 0,
    // 兼容 DeepSeek / 百炼等非官方 OpenAI 接口：
    // 它们通常没有 Responses API，也不一定支持 stream_options。
    useResponsesApi: false,
    streamUsage: false,
    configuration: {
      baseURL
    }
  });
}

export function printError(error: unknown) {
  if (error instanceof Error) {
    console.error(`\n运行失败：${error.message}`);
    return;
  }

  console.error("\n运行失败：发生了未知错误", error);
}
