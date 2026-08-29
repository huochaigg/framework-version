import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { AGENT_SYSTEM_PROMPT, createAgentGraph } from "../v23/create-agent-graph";
import { printError } from "../config/llm";

/**
 * V24 · LangGraph Memory + Checkpoint
 *
 * 模型本身没有突然拥有记忆。
 * 是 LangGraph 用 thread_id + checkpointer 保存并恢复之前的 State，
 * 让下一次模型调用还能看到之前的 messages。
 *
 * 三个概念：
 *   State       = 当前这次 Graph 运行中的数据
 *   Checkpoint  = 把整个 Graph State 存成快照（不只是聊天记录）
 *   Memory      = 应用层看到的「模型记得之前聊过什么」
 *
 * 手写版以前可能是：
 *   根据 conversationId 查数据库历史
 *   → messages.push(userMessage)
 *   → 调用模型
 *   → saveMessages()
 *
 * LangGraph 现在：
 *   第一次 Graph 执行结束 → Checkpointer 自动保存 State
 *   第二次相同 thread_id → 自动恢复旧 State，再追加新的 HumanMessage
 *
 * thread_id 是一条 Graph 会话线程，不是 userId。
 * 同一个用户可以有 conversation-a、conversation-b 多条会话。
 *
 * 这一版只做 thread 级短期记忆。进程重启后 MemorySaver 里的数据会丢，这是允许的。
 * 不做：长期用户记忆、Memory 提取 / 总结、数据库持久化、interrupt / time travel。
 */

function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

function lastModelAnswer(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.getType() !== "ai") {
      continue;
    }

    const aiMessage = message as AIMessage;

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      continue;
    }

    return textFromModel(aiMessage.content);
  }

  return "";
}

async function ask(
  graph: ReturnType<typeof createAgentGraph>,
  threadId: string,
  question: string,
  options?: { includeSystem?: boolean }
) {
  const messages = options?.includeSystem
    ? [new SystemMessage(AGENT_SYSTEM_PROMPT), new HumanMessage(question)]
    : [new HumanMessage(question)];

  // 不要把上一轮 messages 存进变量再传进来。
  // 相同 thread_id 会由 Checkpointer 自动恢复旧 State。
  const finalState = await graph.invoke(
    { messages },
    {
      recursionLimit: 10,
      configurable: {
        thread_id: threadId
      }
    }
  );

  console.log(`thread_id: ${threadId}`);
  console.log(`用户输入：${question}`);
  console.log(`模型回答：${lastModelAnswer(finalState.messages)}`);
}

async function main() {
  try {
    const checkpointer = new MemorySaver();
    const graph = createAgentGraph(checkpointer);

    console.log("=== conversation-a · 第 1 轮 ===");
    // 打断点 1：第一次 graph.invoke 进入 Graph 时，messages 只有 System + 当前 Human。
    await ask(graph, "conversation-a", "我叫小明，我是一名前端工程师。", {
      includeSystem: true
    });

    // 打断点 2：第一次结束后，这个 thread 的 State 已经被 Checkpointer 保存。
    // Checkpoint 是整个 Graph State 的快照，当前主要是 messages，
    // 以后还可能包含检索结果、当前节点、人工审核状态等。
    const savedCheckpoint = await graph.getState({
      configurable: { thread_id: "conversation-a" }
    });
    void savedCheckpoint;

    console.log("");
    console.log("=== conversation-a · 第 2 轮 ===");
    // 打断点 3：第二次进入 callModel 时，messages 应已包含第 1 轮 Human / AI。
    await ask(graph, "conversation-a", "我叫什么？我是做什么的？");

    console.log("");
    console.log("=== conversation-b · 新会话 ===");
    // 打断点 4：新 thread 的 messages 不应包含 conversation-a 的小明 / 前端工程师。
    await ask(graph, "conversation-b", "我叫什么？", {
      includeSystem: true
    });

    console.log("");
    console.log("=== conversation-tool · 带 Tool 的第 1 轮 ===");
    await ask(graph, "conversation-tool", "帮我算一下 23 * 47。", {
      includeSystem: true
    });

    console.log("");
    console.log("=== conversation-tool · 带 Tool 的第 2 轮 ===");
    // 打断点 5：进入 callModel 时，历史里应有上一轮 AIMessage / ToolMessage / 最终 AIMessage。
    await ask(graph, "conversation-tool", "刚才那个结果再乘以 2。");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();

// conversation-a 第一次 invoke
//   → Graph 执行
//   → Checkpointer 保存 State
// conversation-a 第二次 invoke
//   → 自动恢复旧 State
//   → 添加新 HumanMessage
//   → Agent 继续执行（必要时仍走 Tool Loop）
