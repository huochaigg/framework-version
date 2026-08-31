import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mcpTextResult, runCalculator } from "./shared";

/**
 * 给 v31-multi-server 用的 Calculator MCP Server。
 * 只暴露 calculator，和 User Server 拆开，证明一个 Agent 可以同时连多个 Server。
 *
 * 不要单独作为学习入口。请跑 pnpm v31-multi-server。
 */

const server = new McpServer({
  name: "v31-calculator",
  version: "1.0.0"
});

server.registerTool(
  "calculator",
  {
    description:
      "对两个数字做加减乘除。operation 只能是 add、subtract、multiply、divide。",
    inputSchema: {
      a: z.number().describe("第一个数字"),
      b: z.number().describe("第二个数字"),
      operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("运算类型")
    }
  },
  async ({ a, b, operation }) => {
    const output = runCalculator(a, b, operation);
    return mcpTextResult(output);
  }
);

console.error("MCP Server started");

const transport = new StdioServerTransport();
await server.connect(transport);
