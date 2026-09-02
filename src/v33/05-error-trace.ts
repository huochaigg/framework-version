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
import {
  lastModelAnswer,
  projectHint,
  requireLangSmithConfig,
  traceConfig
} from "./shared";

/**
 * V33-5 · 错误发生在哪一层
 *
 * 默认：unstableTool 直接 throw，Trace 应标成 error。
 * pnpm v33-error-trace --caught ：catch 后返回“工具调用失败”，Graph 可能成功结束。
 *
 * 技术异常（throw）和业务可恢复失败（ToolMessage）不是一回事。
 * 打断点：故意 throw 的这一行。
 */

const AgentState = new StateSchema({
  messages: MessagesValue
});

const caught = process.argv.includes("--caught");

const unstableTool = tool(
  ({ mode }) => {
    if (mode === "fail") {
      if (caught) {
        return "工具调用失败：unstableTool 在 mode=fail 时出错。";
      }

      throw new Error("unstableTool failed: 故意制造的错误");
    }

    return { ok: true };
  },
  {
    name: "unstableTool",
    description:
      "测试用工具。用户要求制造错误时必须调用，mode 设为 fail。",
    schema: z.object({
      mode: z.enum(["ok", "fail"]).describe("ok 成功，fail 失败")
    })
  }
);

async function main() {
  requireLangSmithConfig();

  const tools = [unstableTool];
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
    .addNode(
      "tools",
      new ToolNode(tools, {
        handleToolErrors: caught
      })
    )
    .addEdge(START, "callModel")
    .addConditionalEdges("callModel", shouldContinue)
    .addEdge("tools", "callModel")
    .compile();

  const result = await graph.invoke(
    {
      messages: [
        new SystemMessage(
          "用户要求测试错误时必须调用 unstableTool，mode 使用 fail。不要自己编造结果。"
        ),
        new HumanMessage("请调用 unstableTool，mode 用 fail。")
      ]
    },
    traceConfig(caught ? "v33-error-caught" : "v33-error-throw", {
      tags: ["error"],
      metadata: { feature: "error-trace", mode: caught ? "caught" : "throw" }
    })
  );

  console.log(lastModelAnswer(result.messages));
  console.log(
    `\n场景：${caught ? "catch 后返回 ToolMessage" : "直接 throw"}。去 LangSmith 看错误落在哪个 Run。Project：${projectHint()}`
  );
}

try {
  await main();
} catch (error) {
  printError(error);
  console.error(
    `\n场景：直接 throw。去 LangSmith 看 Graph → Tool Node → unstableTool → Error。Project：${projectHint()}`
  );
  process.exitCode = 1;
}
