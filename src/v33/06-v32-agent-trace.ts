import { printError } from "../config/llm";
import { createAgentRuntime, prepareTurn } from "../v32/agent/graph";
import { lastModelAnswer } from "../v32/agent/trace";
import {
  projectHint,
  requireLangSmithConfig,
  traceConfig
} from "./shared";

/**
 * V33-6 · 观察 V32 完整 Agent 的一条 Trace
 *
 * 不要重新实现 Agent。一次只跑一个问题。
 *
 *   pnpm v33-v32-trace "23 * 47 等于多少？"
 *   pnpm v33-v32-trace "LangGraph Checkpoint 是什么？"
 *   pnpm v33-v32-trace "查询 demo-project 项目信息。"
 */

function readQuestion(): string {
  const args = process.argv.slice(2).filter((item) => item !== "--");
  return args.join(" ").trim();
}

async function main() {
  requireLangSmithConfig();

  const question = readQuestion();
  if (!question) {
    throw new Error(
      '请传入一个问题。例如：pnpm v33-v32-trace "23 * 47 等于多少？"'
    );
  }

  const runtime = await createAgentRuntime();

  try {
    const { input, config } = await prepareTurn(
      runtime.graph,
      `v33-v32-${Date.now()}`,
      question
    );

    const result = await runtime.graph.invoke(input, {
      ...config,
      ...traceConfig("v32-agent", {
        tags: ["v32", "chat"],
        metadata: { feature: "v32-agent" }
      })
    });

    console.log(lastModelAnswer(result.messages));
    console.log(
      `\n去 LangSmith 看 Graph → Model → Tool/RAG/MCP → Model。Project：${projectHint()}`
    );
  } finally {
    await runtime.close();
  }
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
