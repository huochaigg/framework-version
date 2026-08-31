import { printError } from "../config/llm";
import { DEMO_QUESTION, createAnalyzeAnswerGraph, textFromModel } from "./shared";

/**
 * V30-4 · streamEvents
 *
 * Token Streaming：模型生成了什么。
 * Event Streaming：整个 Graph 现在正在干什么。
 *
 * 当前 LangGraph 也推荐 v3 typed projections。
 * 本 Demo 用仍受支持的 version: "v2" StreamEvent，因为事件名更容易对照：
 * on_chain_start / on_chat_model_stream / on_chain_end。
 * 只过滤少量事件，不要把全部事件打出来。
 */
function labelFor(eventName: string, runnableName: string): string | undefined {
  if (
    eventName === "on_chain_start" &&
    (runnableName === "analyze" || runnableName === "generateAnswer")
  ) {
    return `START ${runnableName}`;
  }

  if (
    eventName === "on_chain_end" &&
    (runnableName === "analyze" || runnableName === "generateAnswer")
  ) {
    return `END ${runnableName}`;
  }

  if (eventName === "on_chat_model_start") {
    return "START model";
  }

  if (eventName === "on_chat_model_end") {
    return "END model";
  }

  return undefined;
}

async function main() {
  try {
    const graph = createAnalyzeAnswerGraph();

    console.log(`问题：${DEMO_QUESTION}`);
    console.log("streamEvents version: v2");
    console.log("");

    const stream = graph.streamEvents(
      { question: DEMO_QUESTION },
      { version: "v2" }
    );

    for await (const event of stream) {
      // 打断点 4：在这里看 event.event / event.name，再决定打不打印
      if (event.event === "on_chat_model_stream") {
        const text = textFromModel(event.data?.chunk?.content);
        if (text) {
          process.stdout.write(text);
        }
        continue;
      }

      const line = labelFor(event.event, event.name);
      if (line) {
        console.log("");
        console.log(line);
      }
    }

    console.log("");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
