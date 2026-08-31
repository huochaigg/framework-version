import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage
} from "@langchain/core/messages";
import {
  Annotation,
  Command,
  END,
  INTERRUPT,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
  isInterrupted,
  messagesStateReducer
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createChatModel, printError } from "../config/llm";
import { calculator } from "../tools/calculator";
import { transferMoney } from "../tools/transfer-money";

/**
 * V28 · LangGraph Human in the Loop
 *
 * V23 的 Agent Loop：模型决定调用 Tool 后自动执行。
 * V28 要学的生产场景：有副作用的 Tool 不能让模型直接执行，必须先让人确认。
 *
 * 手写版可能是：
 *   if (dangerousTool) {
 *     const approved = await askUser();
 *     if (approved) executeTool();
 *   }
 *
 * LangGraph 对应：
 *   Conditional Edge / Router → interrupt → checkpoint → Command({ resume }) → 继续 Graph
 *
 * Human in the Loop 不是「前端弹个 confirm」。
 * 是 Graph 真正暂停，Checkpointer 保存现场，外部 resume 后再从这里继续。
 *
 * 下面的 readline 只负责收集 yes/no。
 * 真正的暂停发生在 interrupt()，真正的恢复发生在 Command({ resume })。
 * 不要把 readline 当成 Human in the Loop 本身。
 *
 * 这一版不扩展 RAG，不做 Multi-Agent。
 */

const SAFE_TOOLS = [calculator];
const HIGH_RISK_TOOL = "transferMoney";

type ApprovalDecision = "yes" | "no" | undefined;

type TransferArgs = {
  toAccount?: string;
  amount?: number | string;
  remark?: string;
};

type ApprovalInterrupt = {
  toolName: string;
  args: TransferArgs;
  message: string;
};

const HitlState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  approval: Annotation<ApprovalDecision>({
    reducer: (_current, next) => next,
    default: () => undefined
  })
});

const SYSTEM_PROMPT =
  "你是一名助手。需要计算时调用 calculator。用户要求转账、汇款、打钱时必须调用 transferMoney，不要自己假装已经转账。如果工具返回用户已拒绝，用中文简短说明已取消，不要再次调用 transferMoney。普通问题直接用中文简短回答。";

function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

function lastAiMessage(messages: BaseMessage[]): AIMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.getType() === "ai") {
      return message as AIMessage;
    }
  }

  return undefined;
}

function lastToolCalls(messages: BaseMessage[]) {
  return lastAiMessage(messages)?.tool_calls ?? [];
}

function findTransferCall(messages: BaseMessage[]) {
  return lastToolCalls(messages).find((call) => call.name === HIGH_RISK_TOOL);
}

function summarizeToolResult(content: unknown): string {
  const text = textFromModel(content);

  try {
    const parsed = JSON.parse(text) as { result?: unknown };
    if (parsed.result !== undefined) {
      return String(parsed.result);
    }
  } catch {
    // Tool 结果不是 JSON 时，原样截断即可。
  }

  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function lastFinalAnswer(messages: BaseMessage[]): string {
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

function printToolResultsAndAnswer(messages: BaseMessage[]) {
  for (const message of messages) {
    if (message.getType() !== "tool") {
      continue;
    }

    const toolMessage = message as ToolMessage;
    console.log(
      `Tool Result: ${toolMessage.name ?? "unknown"} → ${summarizeToolResult(toolMessage.content)}`
    );
  }

  console.log(`Final Answer: ${lastFinalAnswer(messages)}`);
}

function printCompleted(question: string, messages: BaseMessage[]) {
  console.log(`User: ${question}`);

  for (const message of messages) {
    if (message.getType() !== "ai") {
      continue;
    }

    const aiMessage = message as AIMessage;
    const toolCalls = aiMessage.tool_calls ?? [];
    if (toolCalls.length > 0) {
      console.log(`Model 请求 Tool: ${toolCalls.map((call) => call.name).join(", ")}`);
    }
  }

  printToolResultsAndAnswer(messages);
}

function createHitlGraph(checkpointer: MemorySaver) {
  const modelWithTools = createChatModel().bindTools([calculator, transferMoney]);
  const calculatorNode = new ToolNode(SAFE_TOOLS);

  const callModel = async (state: typeof HitlState.State) => {
    // 打断点 1：看 AIMessage 是否出现 transferMoney tool_call
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  };

  const routeTools = (state: typeof HitlState.State) => {
    const toolCalls = lastToolCalls(state.messages);
    if (toolCalls.length === 0) {
      return END;
    }

    // 打断点 2：Tool Router 判断高风险 Tool
    // 只拦截 transferMoney。calculator 走自动执行。
    if (toolCalls.some((call) => call.name === HIGH_RISK_TOOL)) {
      return "humanApproval";
    }

    return "tools";
  };

  const humanApproval = (state: typeof HitlState.State) => {
    const call = findTransferCall(state.messages);
    const args = (call?.args ?? {}) as TransferArgs;
    const toAccount = String(args.toAccount ?? "");
    const amount = args.amount ?? "";

    // 打断点 3：interrupt() 前。这里还没有执行 transferMoney。
    // resume 后这个 Node 会从头再跑一遍，interrupt() 这次返回人工输入，不再暂停。
    const decision = interrupt({
      toolName: HIGH_RISK_TOOL,
      args,
      message: `模型准备执行 transferMoney，向 ${toAccount} 转账 ${amount} 元，是否确认？`
    }) as string;

    // 打断点 6：resume 后重新进入 Node，decision 就是 Command({ resume }) 带进来的值
    const normalized = String(decision).trim().toLowerCase() === "yes" ? "yes" : "no";
    return { approval: normalized as ApprovalDecision };
  };

  const afterApproval = (state: typeof HitlState.State) => {
    // 打断点 7：批准走 executeTransfer，拒绝走 rejectTransfer
    return state.approval === "yes" ? "executeTransfer" : "rejectTransfer";
  };

  const executeTransfer = async (state: typeof HitlState.State) => {
    const call = findTransferCall(state.messages);
    if (!call?.id) {
      return { messages: [] };
    }

    const args = (call.args ?? {}) as TransferArgs;
    const result = await transferMoney.invoke({
      toAccount: String(args.toAccount ?? ""),
      amount: Number(args.amount ?? 0),
      remark: args.remark
    });
    const content = typeof result === "string" ? result : JSON.stringify(result);
    return {
      messages: [
        new ToolMessage({
          content,
          tool_call_id: call.id,
          name: HIGH_RISK_TOOL
        })
      ]
    };
  };

  const rejectTransfer = (state: typeof HitlState.State) => {
    const call = findTransferCall(state.messages);
    if (!call?.id) {
      return { messages: [] };
    }

    return {
      messages: [
        new ToolMessage({
          content: "用户拒绝了本次工具调用。不要执行转账。",
          tool_call_id: call.id,
          name: HIGH_RISK_TOOL
        })
      ]
    };
  };

  const runSafeTools = async (state: typeof HitlState.State) => {
    return calculatorNode.invoke(state);
  };

  return new StateGraph(HitlState)
    .addNode("callModel", callModel)
    .addNode("tools", runSafeTools)
    .addNode("humanApproval", humanApproval)
    .addNode("executeTransfer", executeTransfer)
    .addNode("rejectTransfer", rejectTransfer)
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", routeTools)
    .addEdge("tools", "callModel")
    .addConditionalEdges("humanApproval", afterApproval)
    .addEdge("executeTransfer", "callModel")
    .addEdge("rejectTransfer", "callModel")
    .compile({ checkpointer });
}

async function askYesNo(rl: ReturnType<typeof createInterface>): Promise<string> {
  while (true) {
    const line = (await rl.question("Human: ")).trim().toLowerCase();
    if (line === "yes" || line === "no") {
      return line;
    }

    console.log("请输入 yes 或 no");
  }
}

async function runTurn(
  graph: ReturnType<typeof createHitlGraph>,
  threadId: string,
  question: string,
  rl?: ReturnType<typeof createInterface>
) {
  const config = {
    recursionLimit: 10,
    configurable: { thread_id: threadId }
  };

  // 阶段 1：第一次 invoke。高风险 Tool 会在 interrupt() 处真正暂停。
  const first = await graph.invoke(
    {
      messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(question)]
    },
    config
  );

  // 阶段 2：检查 interrupt。普通 Tool 不会进这里。
  // 打断点 4：第一次 graph 调用返回的 __interrupt__
  if (!isInterrupted<ApprovalInterrupt>(first)) {
    printCompleted(question, first.messages);
    return;
  }

  const payload = first[INTERRUPT][0]?.value;
  const args = payload?.args ?? {};
  console.log(`User: ${question}`);
  console.log(`Model 请求 Tool: ${payload?.toolName ?? HIGH_RISK_TOOL}`);
  console.log(
    `Human Approval Required: 向 ${args.toAccount ?? ""} 转账 ${args.amount ?? ""} 元，是否批准？`
  );

  if (!rl) {
    throw new Error("高风险 Tool 需要命令行输入 yes 或 no");
  }

  // 阶段 3：读取人工输入。这只是 Demo 的输入方式，不是 Graph 暂停本身。
  const decision = await askYesNo(rl);

  // 阶段 4：从 interrupt 的位置恢复。不要重新 invoke(question)。
  // 打断点 5：Command({ resume }) 把人工决策送回 interrupt() 的返回值
  const resumed = await graph.invoke(new Command({ resume: decision }), config);
  printToolResultsAndAnswer(resumed.messages);
}

async function main() {
  try {
    const checkpointer = new MemorySaver();
    const graph = createHitlGraph(checkpointer);
    const rl = createInterface({ input: stdin, output: stdout });

    try {
      console.log("=== 场景 1：普通 Tool 自动执行 ===");
      await runTurn(graph, "v28-calculator", "23 * 47 等于多少？");

      console.log("");
      console.log("=== 场景 2：高风险 Tool，输入 yes ===");
      await runTurn(
        graph,
        "v28-transfer-yes",
        "帮我给 account-001 转 100 元，备注测试。",
        rl
      );

      console.log("");
      console.log("=== 场景 3：高风险 Tool，输入 no ===");
      await runTurn(graph, "v28-transfer-no", "帮我给 account-001 转 100 元。", rl);
    } finally {
      rl.close();
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();

// START → callModel → routeTools
//   calculator      → tools（自动执行）→ callModel → END
//   transferMoney   → humanApproval
//                     interrupt 暂停，Checkpointer 保存 State
//                     Command({ resume: yes/no }) 恢复
//                     yes → executeTransfer → callModel → END
//                     no  → rejectTransfer  → callModel → END
