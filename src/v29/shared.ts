import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import {
  END,
  START,
  StateGraph,
  StateSchema,
  MessagesValue,
  type BaseCheckpointSaver
} from "@langchain/langgraph";
import { createChatModel } from "../config/llm";

/**
 * V29 共用一个极简 Chat Graph：START → callModel → END。
 * 不接 Tool、不做 RAG、不做人工审批。只观察 State 如何保存和恢复。
 */
export const ChatState = new StateSchema({
  messages: MessagesValue
});

export const DEMO_THREAD_ID = "v29-demo-thread";

export const SYSTEM_PROMPT =
  "你是一名助手。用中文简短回答。如果对话历史里出现过用户的名字或偏好，请直接根据历史回答，不要说不知道。";

export function lastModelAnswer(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.getType() !== "ai") {
      continue;
    }

    const content = (message as AIMessage).content;
    if (typeof content === "string") {
      return content.trim();
    }
  }

  return "";
}

export function createChatGraph(checkpointer: BaseCheckpointSaver) {
  const model = createChatModel();

  const callModel = async (state: typeof ChatState.State) => {
    // 打断点看这里的 state.messages：
    // v29-memory 第二轮、v29-resume 新进程、v29-threads 两个 thread，都应该在这里观察历史是否恢复 / 是否隔离。
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  };

  return new StateGraph(ChatState)
    .addNode("callModel", callModel)
    .addEdge(START, "callModel")
    .addEdge("callModel", END)
    .compile({ checkpointer });
}

export function postgresUrl(): string {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url) {
    throw new Error("缺少 POSTGRES_URL。请在 .env 填写 postgresql://用户:密码@主机:端口/数据库");
  }

  return url;
}

export function createPostgresCheckpointer() {
  return PostgresSaver.fromConnString(postgresUrl());
}
