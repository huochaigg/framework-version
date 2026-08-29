import { Document } from "@langchain/core/documents";

/**
 * 内存知识库。V25 不接 PostgreSQL / pgvector，也不做 PDF Loader。
 * 启动时转成 Documents → Embedding → MemoryVectorStore。
 */
export const knowledgeDocuments: Document[] = [
  new Document({
    pageContent:
      "LangChain 负责 Model、Prompt、Tool、Parser 等组件抽象。它把调用大模型、拼 Prompt、定义工具、解析输出收成统一接口。"
  }),
  new Document({
    pageContent:
      "LangGraph 负责有状态工作流编排。它用 State、Node、Edge 把多步骤 AI 流程组织成 Graph，而不是再写一套大模型 SDK。"
  }),
  new Document({
    pageContent:
      "Checkpoint 可以保存 Graph State。它是整份 State 的快照，不只是聊天记录，以后还可能包含检索结果或人工审核状态。"
  }),
  new Document({
    pageContent:
      "thread_id 用于区分不同 Graph 会话。同一个 thread_id 会恢复之前保存的 State，不同 thread_id 的状态互相隔离。thread_id 不是 userId。"
  }),
  new Document({
    pageContent:
      "Tool Calling 是模型输出工具调用请求。模型只提出要调用哪个工具和什么参数，真正执行发生在 Node 代码里。"
  }),
  new Document({
    pageContent:
      "Agent Loop 是 Model → Tool → Model 的循环。有 tool_calls 就执行工具并把 ToolMessage 加回 messages，再回到模型；没有就结束。"
  }),
  new Document({
    pageContent:
      "RAG 是先检索外部知识再提供给模型。普通 RAG 固定走 Question → Retrieve → Generate；Agentic RAG 会先判断要不要检索。"
  }),
  new Document({
    pageContent:
      "MemorySaver 是内存 Checkpointer。进程重启后数据会丢失。生产环境才需要 Postgres 等持久化 Checkpointer。"
  })
];
