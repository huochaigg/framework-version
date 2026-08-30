import { z } from "zod";
import { createChatModel } from "../config/llm";

type ChatModel = ReturnType<typeof createChatModel>;

/**
 * HyDE = Hypothetical Document Embeddings。
 *
 * 知识库里存的是「文档」，用户输入的是「问题」，语言结构不一样。
 * HyDE 先让模型写一段「假设会出现在技术文档里的答案」，再对这段文字做 embedding 去检索。
 *
 * 假设文档可能包含错误，它只用于检索，不能当最终事实。
 * 最终回答必须基于真正检索到的 Documents。
 *
 * 手写版对应：
 *   hypo = llm.generateHypotheticalDocument(question)
 *   embedding = embedQuery(hypo)          // 不是 embedQuery(question)
 *   docs = searchSimilarChunks(embedding)
 */
const HydeSchema = z.object({
  document: z
    .string()
    .describe("一小段可能出现在技术文档里的假设答案，1～3 句，不要很长")
});

export async function generateHypotheticalDocument(
  model: ChatModel,
  question: string
): Promise<string> {
  const generator = model.withStructuredOutput(HydeSchema, {
    name: "HypotheticalDocument",
    method: "functionCalling"
  });

  const generated = await generator.invoke(
    `根据用户问题，写一小段「可能出现在技术文档里」的假设答案。
只写 1～3 句，像文档摘录，不要对话口吻，不要很长文章。
可以出现 checkpointer、thread_id、graph state 这类术语。
这段文字只用于检索，不是最终事实答案，不要声称来自真实文档。

用户问题：${question}`
  );

  return generated.document.trim();
}

export function shortHypothetical(text: string): string {
  return text.replace(/\s+/g, " ").slice(0, 120);
}
