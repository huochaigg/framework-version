import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { printError } from "../config/llm";
import { jsonText, stdioConnection } from "./shared";

/**
 * V31 Demo 3 · MCP Tool → LangChain Tool
 *
 * 链路：
 *   MCP Server Tool
 *     → MCP Client（连接、listTools）
 *     → MCP Adapter（@langchain/mcp-adapters）
 *     → LangChain Tool（name / description / invoke）
 *
 * 手写 V10 要自己把 MCP schema 转成 OpenAI tools 格式（toLlmTools）。
 * V31 不要手工再包一遍 schema：Adapter 的 getTools() / loadMcpTools() 会转。
 *
 * 上一课 client.callTool() 是 MCP 层直接调用。
 * 这一课 tool.invoke() 是适配成 LangChain Tool 之后调用。
 *
 * 本 Demo 仍然不让模型选 Tool。
 *
 * 运行：pnpm v31-tools
 */

async function main() {
  const client = new MultiServerMCPClient({
    mcpServers: {
      v31: stdioConnection("01-mcp-server.ts")
    }
  });

  try {
    // 打断点 3：Adapter 把 MCP Tools 转成 LangChain Tools。
    const tools = await client.getTools();

    console.log("LangChain tools from MCP:\n");
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }

    const calculator = tools.find((tool) => tool.name === "calculator");
    if (!calculator) {
      throw new Error("没有找到 calculator。请确认 MCP Server 已注册该 Tool。");
    }

    const result = await calculator.invoke({
      a: 23,
      b: 47,
      operation: "multiply"
    });

    console.log(
      "\ncalculator.invoke(23 * 47) →",
      typeof result === "string" ? result : jsonText(result)
    );
  } finally {
    await client.close();
  }
}

try {
  await main();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
