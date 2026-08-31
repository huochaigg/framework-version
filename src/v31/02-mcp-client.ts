import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { printError } from "../config/llm";
import { extractMcpText, stdioConnection } from "./shared";

/**
 * V31 Demo 2 · MCP Client
 *
 * MCP Client 不是 LLM。它只负责：
 *   连接 MCP Server → 发现 Tool → 调用 Tool。
 *
 * 手写 V10（server/src/mcp/client.ts）：
 *   client.connect(transport)
 *   client.listTools()
 *   client.callTool({ name, arguments })
 *
 * V31 官方 SDK 仍然是这三步。协议层没有消失，只是包名换成
 * @modelcontextprotocol/sdk。
 *
 * 这一步还没有 LangGraph，也没有 Adapter。
 *
 * 运行：pnpm v31-client
 * Client 会按 stdio 启动子进程跑 01-mcp-server.ts，这是正常的。
 */

async function main() {
  const launch = stdioConnection("01-mcp-server.ts");
  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    stderr: launch.stderr
  });

  const client = new Client({
    name: "v31-learn-client",
    version: "1.0.0"
  });

  try {
    // 对应手写 V10：client.connect()
    await client.connect(transport);

    // 打断点 2：listTools() 返回 MCP Server 暴露的工具清单。
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);

    console.log("MCP tools:", names.join(", "));

    // 对应手写 V10：client.callTool()
    // 这里是 MCP 层直接调用，不经过 LangChain Tool.invoke()。
    const result = await client.callTool({
      name: "calculator",
      arguments: {
        a: 23,
        b: 47,
        operation: "multiply"
      }
    });

    console.log("calculator(23 * 47) →", extractMcpText(result.content));
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
