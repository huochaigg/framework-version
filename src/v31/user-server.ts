import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mcpTextResult, mockUserInfo } from "./shared";

/**
 * 给 v31-multi-server 用的 User MCP Server。
 * 只暴露 getUserInfo。模拟数据，不接 MySQL。
 *
 * 不要单独作为学习入口。请跑 pnpm v31-multi-server。
 */

const server = new McpServer({
  name: "v31-user",
  version: "1.0.0"
});

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
