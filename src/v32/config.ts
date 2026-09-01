import "dotenv/config";

/**
 * V32 项目配置。
 * conversationId → thread_id 只是当前项目的简单映射，
 * 不是 LangGraph 强制要求。LangGraph 只认 thread_id。
 */

export const V32_PORT = Number(process.env.V32_PORT ?? 3200);

export const AGENT_SYSTEM_PROMPT = `你是 AI Developer Assistant，面向程序员的技术助手。
能直接回答的问题就直接回答，不要为了用工具而用工具。
涉及 LangChain、LangGraph、RAG、MCP、Checkpoint、Streaming、Tool Calling、Agent Loop 等项目知识时，调用 searchKnowledgeBase。
需要计算时调用 calculator，不要自己心算。
需要当前时间时调用 getCurrentTime。
需要本机运行环境信息时调用 getRuntimeInfo。
查询模拟项目资料时调用 getProjectInfo。
不要编造 Tool 返回结果。如果 Tool 失败，明确告诉用户。
用中文简短回答。`;

export function postgresUrl(): string {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url) {
    throw new Error(
      "checkpoint failed: 缺少 POSTGRES_URL。请在 .env 填写 postgresql://用户:密码@主机:端口/数据库"
    );
  }

  return url;
}

export function threadIdFromConversation(conversationId: string): string {
  const id = conversationId.trim();
  return id.length > 0 ? id : "v32-default";
}

export function layerError(layer: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.startsWith(`${layer}:`)) {
    return error instanceof Error ? error : new Error(`${layer}: ${detail}`);
  }

  return new Error(`${layer}: ${detail}`);
}
