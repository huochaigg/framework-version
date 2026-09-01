import type { CompiledAgentGraph } from "../agent/graph";
import type { AgentStateType } from "../agent/state";
import { textFromModel } from "../agent/trace";

export type AgentStatus =
  | "thinking"
  | "tool_calling"
  | "retrieving"
  | "generating";

export type AgentUiEvent =
  | { type: "status"; status: AgentStatus }
  | { type: "tool"; name: string }
  | { type: "token"; token: string }
  | { type: "done" }
  | { type: "error"; message: string };

type StreamEvent = {
  event: string;
  name?: string;
  data?: {
    chunk?: {
      content?: unknown;
      tool_call_chunks?: unknown[];
    };
  };
};

/**
 * 把 LangGraph streamEvents 收成 UI 真正需要的几种事件。
 * 不要把内部 event 原样发给前端。
 */
export async function* iterateAgentUiEvents(
  graph: CompiledAgentGraph,
  input: AgentStateType,
  config: { configurable: { thread_id: string }; recursionLimit: number }
): AsyncGenerator<AgentUiEvent> {
  let emittedGenerating = false;

  try {
    yield { type: "status", status: "thinking" };

    const stream = graph.streamEvents(input, {
      ...config,
      version: "v2"
    });

    for await (const raw of stream) {
      const event = raw as StreamEvent;

      if (event.event === "on_tool_start" && event.name) {
        yield { type: "tool", name: event.name };
        yield {
          type: "status",
          status:
            event.name === "searchKnowledgeBase" ? "retrieving" : "tool_calling"
        };
        continue;
      }

      if (event.event !== "on_chat_model_stream") {
        continue;
      }

      const chunk = event.data?.chunk;
      if (chunk?.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        continue;
      }

      const token = textFromModel(chunk?.content);
      if (!token) {
        continue;
      }

      if (!emittedGenerating) {
        emittedGenerating = true;
        yield { type: "status", status: "generating" };
      }

      yield { type: "token", token };
    }

    yield { type: "done" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield { type: "error", message };
  }
}
