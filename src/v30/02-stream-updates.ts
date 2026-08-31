import { printError } from "../config/llm";
import { DEMO_QUESTION, createAnalyzeAnswerGraph, shortText } from "./shared";

/**
 * V30-2 · streamMode: "updates"
 *
 * values：每次返回完整 State。
 * updates：只返回「这一步某个 Node 改了哪些字段」。
 *
 * 例如 analyze 只返回 { analysis }，generateAnswer 只返回 { answer }。
 */
function printUpdate(update: Record<string, unknown>) {
  for (const [nodeName, patch] of Object.entries(update)) {
    const fields =
      patch && typeof patch === "object"
        ? Object.entries(patch as Record<string, unknown>)
            .map(([key, value]) => `${key}=${shortText(typeof value === "string" ? value : String(value))}`)
            .join("，")
        : String(patch);
    console.log(`${nodeName} 更新：${fields}`);
  }
}

async function main() {
  try {
    const graph = createAnalyzeAnswerGraph();

    console.log(`问题：${DEMO_QUESTION}`);
    console.log("streamMode: updates");
    console.log("");

    const stream = await graph.stream(
      { question: DEMO_QUESTION },
      { streamMode: "updates" }
    );

    for await (const update of stream) {
      // 打断点 2：这里只有本次 Node 的增量，不是完整 State
      printUpdate(update as Record<string, unknown>);
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
