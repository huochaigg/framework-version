import "dotenv/config";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";

/**
 * V33 共用：检查 LangSmith 环境变量，并给 invoke 带上少量 tags / metadata。
 * 不要做成 ObservabilityService。
 *
 * 官方推荐：LANGSMITH_TRACING=true 后，LangChain / LangGraph 会自动上报 Trace。
 * CLI 脚本跑完就退出，关掉 callback background，避免进程退出时 Trace 还没发出去。
 */
process.env.LANGCHAIN_CALLBACKS_BACKGROUND ??= "false";

export function requireLangSmithConfig() {
  const tracing = process.env.LANGSMITH_TRACING?.trim();
  const apiKey = process.env.LANGSMITH_API_KEY?.trim();

  if (tracing !== "true") {
    throw new Error(
      "缺少 LANGSMITH_TRACING=true。V33 需要打开 LangSmith tracing。请在 .env 写入 LANGSMITH_TRACING=true。"
    );
  }

  if (!apiKey || apiKey.includes("your_langsmith")) {
    throw new Error(
      "缺少 LANGSMITH_API_KEY。请到 https://smith.langchain.com 创建 API Key，写入 .env，不要提交到 Git。"
    );
  }
}

export function projectHint() {
  return process.env.LANGSMITH_PROJECT?.trim() || "default";
}

export function traceConfig(
  runName: string,
  extra?: { tags?: string[]; metadata?: Record<string, unknown> }
) {
  return {
    runName,
    tags: ["v33", ...(extra?.tags ?? [])],
    metadata: {
      version: "v33",
      environment: "development",
      ...extra?.metadata
    }
  };
}

export function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export function lastModelAnswer(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.getType() !== "ai") {
      continue;
    }

    const aiMessage = message as AIMessage;
    if ((aiMessage.tool_calls?.length ?? 0) > 0) {
      continue;
    }

    return textFromModel(aiMessage.content);
  }

  return "";
}
