import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StdioConnection } from "@langchain/mcp-adapters";
import {
  AIMessage,
  ToolMessage,
  type BaseMessage
} from "@langchain/core/messages";

const require = createRequire(import.meta.url);

export const v31Dir = path.dirname(fileURLToPath(import.meta.url));

/** Windows 下用当前 Node + 项目里的 tsx，不要写死 Unix 路径。 */
export const tsxCli = require.resolve("tsx/cli");

export type CalculatorOperation = "add" | "subtract" | "multiply" | "divide";

/**
 * 真正干活的 JS。MCP Server 只是把这份能力对外暴露。
 * Agent 看不到这段代码；模型只看到 tool name / description / schema。
 */
export function runCalculator(
  a: number,
  b: number,
  operation: CalculatorOperation
) {
  if (operation === "add") {
    return { result: a + b };
  }

  if (operation === "subtract") {
    return { result: a - b };
  }

  if (operation === "multiply") {
    return { result: a * b };
  }

  if (b === 0) {
    throw new Error("除数不能为 0");
  }

  return { result: a / b };
}

/** 模拟用户资料。不要接 MySQL，不要查真实数据库。 */
export function mockUserInfo(userId: string) {
  return {
    userId,
    name: "Tom",
    role: "frontend engineer"
  };
}

export function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

export function mcpTextResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: jsonText(value) }]
  };
}

/**
 * 启动本地 stdio MCP Server 的参数。
 * Client / Adapter 会 spawn 子进程；stdout 是协议通道。
 */
export function stdioConnection(scriptName: string): StdioConnection {
  return {
    transport: "stdio",
    command: process.execPath,
    args: [tsxCli, path.join(v31Dir, scriptName)],
    stderr: "inherit"
  };
}

export function extractMcpText(content: unknown): string {
  if (!Array.isArray(content)) {
    return typeof content === "string" ? content : jsonText(content);
  }

  return content
    .filter(
      (block) =>
        block &&
        typeof block === "object" &&
        "type" in block &&
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string"
    )
    .map((block) => (block as { text: string }).text)
    .join("\n");
}

export function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

/**
 * V31 Agent 控制台：只看 User / 请求了哪个 MCP Tool / Tool Result / Final Answer。
 * 不要打印 JSON-RPC、stdin/stdout 原始包、完整 AIMessage metadata。
 */
export function printAgentTrace(messages: BaseMessage[]) {
  for (const message of messages) {
    if (message.getType() === "human") {
      console.log(`User → ${textFromModel(message.content)}`);
      continue;
    }

    if (message.getType() === "ai") {
      const aiMessage = message as AIMessage;
      const toolCalls = aiMessage.tool_calls ?? [];

      if (toolCalls.length > 0) {
        const names = toolCalls.map((call) => call.name).join(", ");
        console.log(`Model → 请求 MCP Tool: ${names}`);
        continue;
      }

      console.log(`Final Answer → ${textFromModel(aiMessage.content)}`);
      continue;
    }

    if (message.getType() === "tool") {
      const toolMessage = message as ToolMessage;
      const result = textFromModel(toolMessage.content);
      console.log(
        `Tool Result → ${toolMessage.name ?? "unknown"} 返回 ${result}`
      );
    }
  }
}
