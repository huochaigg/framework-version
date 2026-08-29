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

先复制环境变量：

  cp .env.example .env

然后填入 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL。
`);
