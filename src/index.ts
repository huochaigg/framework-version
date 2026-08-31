console.log(`
V21 · LangChain Fundamentals
============================

这是框架学习阶段的第一课。只覆盖 LangChain 基础积木，不引入 LangGraph，也不实现 Agent。

建议按这个顺序逐个运行、打断点：

  1. pnpm demo:chat         Chat Model / invoke / stream
  2. pnpm demo:messages     SystemMessage / HumanMessage / AIMessage
  3. pnpm demo:prompt       PromptTemplate / ChatPromptTemplate
  4. pnpm demo:lcel         Prompt → Model → Parser（本课重点）
  5. pnpm demo:parser       StringOutputParser / JsonOutputParser
  6. pnpm demo:structured   Zod + withStructuredOutput
  7. pnpm demo:tool         tool() 定义并直接 invoke
  8. pnpm v22               LangGraph：State / Node / Edge / Graph
  9. pnpm v23               LangGraph Agent Loop
  10. pnpm v24              LangGraph Memory + Checkpoint
  11. pnpm v25              LangGraph Agentic RAG
  12. pnpm v26              LangGraph Advanced Agentic RAG
  13. pnpm v27              Advanced RAG：Rerank / Multi Query / HyDE
  14. pnpm v28              LangGraph Human in the Loop：interrupt / resume
  15. pnpm v29-setup         V29：初始化 PostgreSQL Checkpointer 表
  16. pnpm v29-memory        V29：内存 Checkpoint 对照
  17. pnpm v29-save          V29：写入 PostgreSQL 后退出
  18. pnpm v29-resume        V29：新进程按 thread_id 恢复
  19. pnpm v29-threads       V29：thread 隔离
  20. pnpm v30-values         V30：streamMode values
  21. pnpm v30-updates        V30：streamMode updates
  22. pnpm v30-messages       V30：LLM token 流
  23. pnpm v30-events         V30：执行事件流
  24. pnpm v30-sse            V30：Graph Stream → SSE
  25. pnpm v31-server         V31：只启动 MCP Server
  26. pnpm v31-client         V31：MCP Client listTools / callTool
  27. pnpm v31-tools          V31：MCP Tool → LangChain Tool
  28. pnpm v31-agent          V31：LangGraph Agent 调用 MCP Tool
  29. pnpm v31-multi-server   V31：一个 Agent 同时用两个 MCP Server

先复制环境变量：

  cp .env.example .env

然后填入 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL。
`);
