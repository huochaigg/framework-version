import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mcpTextResult, mockUserInfo, runCalculator } from "./shared";

/**
 * V31 Demo 1 · MCP Server
 *
 * MCP Server 本质上是「对外暴露能力」。
 * 能力可以是 Tool、Resource、Prompt；V31 只关注 Tool。
 *
 * 它不调用 LLM，也不跑 Agent Loop。
 * 只做：注册 Tool → 收到调用 → 执行 JS → 返回结果。
 *
 * 手写 V10：mcp-server 里 registerTool + serveStdio。
 * V31：官方 @modelcontextprotocol/sdk 的 McpServer + StdioServerTransport。
 *
 * stdout 是 JSON-RPC 协议通道。日志只能走 stderr。
 *
 * 运行：pnpm v31-server
 * 这个命令只启动 Server，不启动 Client。stdio Server 会等 stdin，Ctrl+C 退出。
 */

const server = new McpServer({
  name: "v31-tools",
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
    // 打断点 1 / 6：MCP Server 收到 calculator 调用，并在这里执行后返回。
    const output = runCalculator(a, b, operation);
    return mcpTextResult(output);
  }
);

server.registerTool(
  "getUserInfo",
  {
    description:
      "按 userId 查询模拟用户信息。返回姓名和角色，不是真实数据库。",
    inputSchema: {
      userId: z.string().describe("用户 ID，例如 user-001")
    }
  },
  async ({ userId }) => {
    return mcpTextResult(mockUserInfo(userId));
  }
);

console.error("MCP Server started");

const transport = new StdioServerTransport();
await server.connect(transport);
