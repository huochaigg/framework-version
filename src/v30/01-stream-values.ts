import { printError } from "../config/llm";
import {
  DEMO_QUESTION,
  createAnalyzeAnswerGraph,
  shortText,
  type GraphStateType
} from "./shared";

/**
 * V30-1 · streamMode: "values"
 *
 * graph.invoke()：等整个 Graph 跑完，一次性拿最终 State。
 * graph.stream()：执行过程中不断返回中间结果。
 *
 * values = 每一步之后「整个 State 现在长什么样」。
 */
async function main() {
  try {
    const graph = createAnalyzeAnswerGraph();

    console.log(`问题：${DEMO_QUESTION}`);
    console.log("streamMode: values");
    console.log("");

    const stream = await graph.stream(
      { question: DEMO_QUESTION },
      { streamMode: "values" }
    );

    let step = 0;
    for await (const state of stream) {
      // 打断点 1：每次拿到一个完整 State chunk
      step += 1;
      const snapshot = state as GraphStateType;
      console.log(
        `第 ${step} 步：question=${shortText(snapshot.question)} | analysis=${shortText(snapshot.analysis)} | answer=${shortText(snapshot.answer)}`
      );
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
