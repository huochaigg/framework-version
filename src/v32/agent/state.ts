import { MessagesValue, StateSchema } from "@langchain/langgraph";

/**
 * V32 核心 State 只有 messages。
 * conversationId 在 API 层映射成 thread_id，不必再塞进 State。
 * RAG 结果走 ToolMessage，也不需要 retrievedDocs 字段。
 */
export const AgentState = new StateSchema({
  messages: MessagesValue
});

export type AgentStateType = typeof AgentState.State;
