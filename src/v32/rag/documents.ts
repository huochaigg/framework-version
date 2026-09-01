import { Document } from "@langchain/core/documents";

/**
 * V32 开发知识库。大约十几条即可。
 * 不接 pgvector。Baseline 检索足够；知识库变大后再考虑 Multi Query / Rerank。
 */
export const knowledgeDocuments: Document[] = [
  new Document({
    pageContent:
      "LangChain 提供能力组件：Chat Model、Prompt、Tool、Parser、Embeddings、VectorStore。它不负责编排多步骤 Agent 流程。",
    metadata: { id: "langchain", title: "LangChain" }
  }),
  new Document({
    pageContent:
      "LangGraph 负责组织 Agent 的状态和流程。用 State、Node、Edge 把 Model 调用、Tool 执行、分支和循环编排成 Graph。",
    metadata: { id: "langgraph", title: "LangGraph" }
  }),
  new Document({
    pageContent:
      "Agent Loop 的核心是 Model → Tool → Model。模型如果返回 tool_calls，就执行 Tool，把 ToolMessage 写回 messages，再回到模型；没有 tool_calls 就结束。",
    metadata: { id: "agent-loop", title: "Agent Loop" }
  }),
  new Document({
    pageContent:
      "Tool Calling 是模型输出工具调用请求。模型只决定调用哪个工具和什么参数。真正执行发生在 ToolNode 或本地 JS 里，不在模型内部。",
    metadata: { id: "tool-calling", title: "Tool Calling" }
  }),
  new Document({
    pageContent:
      "统一 Agent Tool 模型：calculator、当前时间、RAG 检索、MCP 外部能力，对 Agent 来说都是可以选择调用的 Tool。上层 Graph 流程基本没有区别。",
    metadata: { id: "unified-tools", title: "统一 Tool 模型" }
  }),
  new Document({
    pageContent:
      "RAG 是先检索外部知识再提供给模型。V32 把 Retriever 包装成 searchKnowledgeBase Tool，由模型判断要不要检索，而不是 Graph 里写死 retrieve Node。",
    metadata: { id: "rag", title: "RAG" }
  }),
  new Document({
    pageContent:
      "知识库很小时，Baseline Vector Retriever 通常够用。召回质量不足时，再增加 Multi Query、HyDE 或 Rerank。这些是优化策略，不是 Agent 主流程。",
    metadata: { id: "rag-tuning", title: "RAG 优化" }
  }),
  new Document({
    pageContent:
      "MCP Server 对外暴露能力，MCP Client 负责连接和调用，MCP Adapter 把 MCP Tool 转成 LangChain Tool。MCP 不负责 Agent 推理。",
    metadata: { id: "mcp", title: "MCP" }
  }),
  new Document({
    pageContent:
      "本地 Tool 的函数通常和 Agent 在同一进程。MCP Tool 的能力由独立 MCP Server 进程提供。模型看到的都是 name、description、schema，不知道背后是不是 MCP。",
    metadata: { id: "local-vs-mcp", title: "本地 Tool 与 MCP Tool" }
  }),
  new Document({
    pageContent:
      "LangGraph Checkpoint 会保存整份 Graph State，不只是聊天记录。生产环境使用 PostgreSQL Checkpointer，进程重启后仍可用同一个 thread_id 恢复。",
    metadata: { id: "checkpoint", title: "LangGraph Checkpoint" }
  }),
  new Document({
    pageContent:
      "thread_id 用来区分 Graph 会话。同一个 thread_id 会恢复之前保存的 State。不同 thread_id 互相隔离。thread_id 不是 userId。当前项目把 conversationId 简单映射成 thread_id。",
    metadata: { id: "thread-id", title: "thread_id" }
  }),
  new Document({
    pageContent:
      "不要自己另外维护一份内存 messages 数组当主 Memory。多轮对话应交给 Checkpointer。invoke 时只追加本轮 HumanMessage，历史由 Checkpointer 恢复。",
    metadata: { id: "memory", title: "Memory" }
  }),
  new Document({
    pageContent:
      "Streaming 分两层：Token Streaming 回答模型生成了什么；Event Streaming 回答 Agent 现在正在干什么。SSE 只是把这些事件传给浏览器。",
    metadata: { id: "streaming", title: "Streaming" }
  }),
  new Document({
    pageContent:
      "SSE 不是 LangGraph 的功能。链路是 LangGraph Stream → Express → SSE → Client。服务端应过滤事件，只留下 status、tool、token、done、error。",
    metadata: { id: "sse", title: "SSE" }
  }),
  new Document({
    pageContent:
      "高风险 Tool 可以在执行前加入 Human in the Loop：interrupt 暂停，人工确认后再 resume。普通聊天、计算、知识检索不必默认插入审批。",
    metadata: { id: "hitl", title: "Human Approval" }
  }),
  new Document({
    pageContent:
      "V32 是单 Agent 多能力：一个 Agent 同时使用本地 Tool、RAG Tool 和 MCP Tool。能由一个 Agent 解决的问题不要拆成多个 Agent。",
    metadata: { id: "single-agent", title: "单 Agent" }
  })
];
