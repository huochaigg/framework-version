import { tool } from "@langchain/core/tools";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { z } from "zod";

/**
 * RAG 也是 Tool。
 * 手写 V11/V17：searchKnowledge 是 Tool Router 里的一项。
 * V32：searchKnowledgeBase 和 calculator 一样 bind 给模型。
 */
export function createKnowledgeTool(store: MemoryVectorStore) {
  return tool(
    async ({ query }) => {
      try {
        // 打断点：VectorStore 返回 Documents。
        const docs = await store.similaritySearch(query, 4);
        if (docs.length === 0) {
          return "知识库没有找到相关内容。";
        }

        return docs
          .map((doc, index) => `${index + 1}. ${doc.pageContent}`)
          .join("\n\n");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return `Vector search failed: ${detail}`;
      }
    },
    {
      name: "searchKnowledgeBase",
      description:
        "检索 AI 开发知识库。问题涉及 LangChain、LangGraph、RAG、MCP、Checkpoint、Streaming、Tool Calling、Agent Loop 时调用。输入自然语言 query。",
      schema: z.object({
        query: z.string().describe("检索语句")
      })
    }
  );
}
