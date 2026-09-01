import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * V32 Developer MCP Server。
 * 只暴露 getProjectInfo。模拟项目资料，不接真实业务系统。
 *
 * stdout 是协议通道，日志走 stderr。
 * 运行：pnpm v32-mcp-server
 * Agent 通过 stdio 拉起本文件时也会打印 MCP Server started。
 */

const PROJECTS: Record<
  string,
  { name: string; stack: string[]; owner: string; status: string }
> = {
  "demo-project": {
    name: "demo-project",
    stack: ["Vue", "LangGraph", "PostgreSQL"],
    owner: "Tom",
    status: "active"
  }
};

const server = new McpServer({
  name: "v32-developer",
  version: "1.0.0"
});

server.registerTool(
  "getProjectInfo",
  {
    description:
      "按项目名查询模拟项目资料，返回技术栈、负责人和状态。不是真实公司系统。",
    inputSchema: {
      projectName: z.string().describe("项目名，例如 demo-project")
    }
  },
  async ({ projectName }) => {
    const project = PROJECTS[projectName] ?? {
      name: projectName,
      stack: [],
      owner: "unknown",
      status: "not found"
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(project) }]
    };
  }
);

console.error("MCP Server started");

const transport = new StdioServerTransport();
await server.connect(transport);
