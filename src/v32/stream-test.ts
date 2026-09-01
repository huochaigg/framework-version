import { printError } from "../config/llm";
import { createAgentRuntime, prepareTurn } from "./agent/graph";
import { iterateAgentUiEvents } from "./server/events";

/**
 * 只测 Graph Streaming，不启动 HTTP / 前端。
 * 事件过滤逻辑和 SSE 共用 iterateAgentUiEvents。
 */

async function main() {
  const runtime = await createAgentRuntime();
  const question = "23 * 47 等于多少？";

  try {
    const { input, config } = await prepareTurn(
      runtime.graph,
      `v32-stream-${Date.now()}`,
      question
    );

    console.log(`问题：${question}`);
    process.stdout.write("Answer → ");

    for await (const event of iterateAgentUiEvents(runtime.graph, input, config)) {
      if (event.type === "status") {
        console.log("");
        console.log(`[status] ${event.status}`);
        continue;
      }

      if (event.type === "tool") {
        console.log(`[tool] ${event.name}`);
        continue;
      }

      if (event.type === "token") {
        process.stdout.write(event.token);
        continue;
      }

      if (event.type === "done") {
        console.log("");
        console.log("[done]");
        continue;
      }

      console.log(`[error] ${event.message}`);
    }
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
