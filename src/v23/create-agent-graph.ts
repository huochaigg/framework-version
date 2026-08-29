import { AIMessage } from "@langchain/core/messages";
import {
  END,
  MessagesValue,
  START,
  StateGraph,
  StateSchema,
  type BaseCheckpointSaver
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createChatModel } from "../config/llm";
import { calculator } from "../tools/calculator";
import { getCurrentTime } from "../tools/current-time";

const tools = [calculator, getCurrentTime];

// V23 / V24 共用：核心 State 仍然只有 messages。
export const AgentState = new StateSchema({
  messages: MessagesValue
});

export const AGENT_SYSTEM_PROMPT =
  "你是一名助手。需要计算时调用 calculator，需要当前时间时调用 getCurrentTime。不要自己编造算术结果或当前时间。普通概念题直接用中文简短回答。";

/**
 * 创建 V23 的 Agent Graph。
 * 不传 checkpointer：每次 invoke 都是一次独立执行（V23）。
 * 传入 checkpointer：按 thread_id 保存 / 恢复 State（V24）。
 */
export function createAgentGraph(checkpointer?: BaseCheckpointSaver) {
  const modelWithTools = createChatModel().bindTools(tools);

  const callModel = async (state: typeof AgentState.State) => {
    // V23 打断点：第一次只有 System + Human；第二次应有 ToolMessage。
    // V24 打断点：同一 thread 的后续轮次，这里应已包含更早的 Human / AI / Tool 消息。
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  };

  const shouldContinue = (state: typeof AgentState.State) => {
    const lastMessage = state.messages.at(-1);
    const toolCalls =
      lastMessage && lastMessage.getType() === "ai"
        ? (lastMessage as AIMessage).tool_calls
        : undefined;

    if (toolCalls && toolCalls.length > 0) {
      return "tools";
    }

    return END;
  };

  const innerToolNode = new ToolNode(tools);
  const toolsNode = async (state: typeof AgentState.State) => {
    return innerToolNode.invoke(state);
  };

  const builder = new StateGraph(AgentState)
    .addNode("callModel", callModel)
    .addNode("tools", toolsNode)
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue)
    .addEdge("tools", "callModel");

  if (checkpointer) {
    return builder.compile({ checkpointer });
  }

  return builder.compile();
}
