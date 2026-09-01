import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import {
  END,
  START,
  StateGraph,
  type BaseCheckpointSaver
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createChatModel } from "../../config/llm";
import {
  AGENT_SYSTEM_PROMPT,
  layerError,
  postgresUrl,
  threadIdFromConversation
} from "../config";
import { loadMcpTools } from "../mcp/client";
import { createKnowledgeStore } from "../rag/vector-store";
import { localTools } from "../tools";
import { createKnowledgeTool } from "../tools/knowledge";
import { AgentState, type AgentStateType } from "./state";

export type CompiledAgentGraph = ReturnType<typeof buildGraph>;

function buildGraph(
  allTools: StructuredToolInterface[],
  checkpointer: BaseCheckpointSaver
) {
  const modelWithTools = createChatModel().bindTools(allTools);

  const callModel = async (state: AgentStateType) => {
    // 打断点：第一次看 messages；有 tool_calls 时看 AIMessage；第二次应有 ToolMessage。
    try {
      const response = await modelWithTools.invoke(state.messages);
      return { messages: [response] };
    } catch (error) {
      throw layerError("LLM request failed", error);
    }
  };

  const shouldContinue = (state: AgentStateType) => {
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

  const innerToolNode = new ToolNode(allTools);
  const toolsNode = async (state: AgentStateType) => {
    // 打断点：看上一条 AIMessage.tool_calls，确认要执行哪个 Tool。
    // 本地 JS、RAG Tool、MCP Tool 都从这里走同一条 ToolNode。
    // 若是 getProjectInfo，接下来才是 MCP Client 向 Server 发请求。
    try {
      return await innerToolNode.invoke(state);
    } catch (error) {
      throw layerError("Tool execution failed", error);
    }
  };

  return new StateGraph(AgentState)
    .addNode("callModel", callModel)
    .addNode("tools", toolsNode)
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue)
    .addEdge("tools", "callModel")
    .compile({ checkpointer });
}

export function createAgentGraph(
  allTools: StructuredToolInterface[],
  checkpointer: BaseCheckpointSaver
) {
  return buildGraph(allTools, checkpointer);
}

export type AgentRuntime = {
  graph: CompiledAgentGraph;
  close: () => Promise<void>;
};

/**
 * CLI / HTTP / checkpoint / stream 测试都走这一份运行时。
 * 不要复制第二套 Agent Graph。
 */
export async function createAgentRuntime(): Promise<AgentRuntime> {
  let checkpointer: PostgresSaver | undefined;
  let mcpClose: (() => Promise<void>) | undefined;

  try {
    checkpointer = PostgresSaver.fromConnString(postgresUrl());
    try {
      await checkpointer.setup();
    } catch (error) {
      throw layerError("checkpoint failed", error);
    }

    const mcp = await loadMcpTools();
    mcpClose = mcp.close;

    const store = await createKnowledgeStore();
    const knowledgeTool = createKnowledgeTool(store);
    const allTools = [...localTools, knowledgeTool, ...mcp.tools];

    const graph = createAgentGraph(allTools, checkpointer);

    return {
      graph,
      close: async () => {
        if (mcpClose) {
          await mcpClose();
        }
        await checkpointer?.end();
      }
    };
  } catch (error) {
    if (mcpClose) {
      await mcpClose().catch(() => undefined);
    }
    await checkpointer?.end().catch(() => undefined);
    throw error;
  }
}

export async function prepareTurn(
  graph: CompiledAgentGraph,
  conversationId: string,
  message: string
) {
  const threadId = threadIdFromConversation(conversationId);
  const config = {
    configurable: { thread_id: threadId },
    recursionLimit: 12
  };

  let hasHistory = false;
  try {
    const snapshot = await graph.getState(config);
    const messages = snapshot.values?.messages;
    hasHistory = Array.isArray(messages) && messages.length > 0;
  } catch (error) {
    throw layerError("checkpoint failed", error);
  }

  // 已有历史时只追加本轮 HumanMessage。不要自己维护一份内存 messages。
  const input = {
    messages: hasHistory
      ? [new HumanMessage(message)]
      : [new SystemMessage(AGENT_SYSTEM_PROMPT), new HumanMessage(message)]
  };

  return { input, config, threadId };
}
