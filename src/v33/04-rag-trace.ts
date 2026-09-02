import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  END,
  MessagesValue,
  START,
  StateGraph,
  StateSchema
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { createChatModel, printError } from "../config/llm";
import { createKnowledgeStore } from "../rag/store";
import {
  lastModelAnswer,
  projectHint,
  requireLangSmithConfig,
  traceConfig
} from "./shared";

/**
 * V33-4 · RAG 答错时顺着 Trace 往前查
 *
 * Agent Model → searchKnowledgeBase → Retriever → Documents → 第二次 Model
 *
 * 排查顺序：Question → 是否选了 RAG Tool → 实际 Query → Documents → 传给最终 Model 的 Context → 最终回答。
 * 打断点：Retriever 返回 Documents。
 */

const AgentState = new StateSchema({
  messages: MessagesValue
});

async function main() {
  requireLangSmithConfig();

  const store = await createKnowledgeStore();
  const retriever = store.asRetriever({ k: 4 }).withConfig({
    runName: "knowledge-search"
  });

  const searchKnowledgeBase = tool(
    async ({ query }) => {
      const docs = await retriever.invoke(query);
      if (docs.length === 0) {
        return "知识库没有找到相关内容。";
      }

      return docs
        .map((doc, index) => `${index + 1}. ${doc.pageContent}`)
        .join("\n\n");
    },
    {
      name: "searchKnowledgeBase",
      description:
        "检索 AI 开发知识库。问题涉及 LangGraph、Checkpoint、RAG 时必须调用。",
      schema: z.object({
        query: z.string().describe("检索语句")
      })
    }
  );

  const tools = [searchKnowledgeBase];
  const modelWithTools = createChatModel().bindTools(tools);

  const callModel = async (state: typeof AgentState.State) => {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  };

  const shouldContinue = (state: typeof AgentState.State) => {
    const lastMessage = state.messages.at(-1);
    const toolCalls =
      lastMessage && lastMessage.getType() === "ai"
        ? (lastMessage as AIMessage).tool_calls
        : undefined;
    return toolCalls && toolCalls.length > 0 ? "tools" : END;
  };

  const graph = new StateGraph(AgentState)
    .addNode("callModel", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue)
    .addEdge("tools", "callModel")
    .compile();

  const result = await graph.invoke(
    {
      messages: [
        new SystemMessage(
          "你是一名助手。涉及 LangGraph Checkpoint 等知识时必须调用 searchKnowledgeBase，不要编造。"
        ),
        new HumanMessage("LangGraph Checkpoint 是什么？")
      ]
    },
    traceConfig("v33-rag-agent", {
      tags: ["rag"],
      metadata: { feature: "rag" }
    })
  );

  console.log(lastModelAnswer(result.messages));
  console.log(
    `\n去 LangSmith 区分 Agent Model、Knowledge Tool、Retriever、最终 Model。Project：${projectHint()}`
  );
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
