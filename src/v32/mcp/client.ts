import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { layerError } from "../config";

const require = createRequire(import.meta.url);
const mcpDir = path.dirname(fileURLToPath(import.meta.url));
const tsxCli = require.resolve("tsx/cli");

/**
 * 用官方 MCP Adapter 把 Developer MCP Server 的 Tool 转成 LangChain Tool。
 * 手写 V10：自己 connect / listTools / 再转成 OpenAI tools。
 * V32：getTools() 已经是 LangChain Tool，可以直接 bindTools。
 */
export async function loadMcpTools() {
  try {
    const client = new MultiServerMCPClient({
      mcpServers: {
        developer: {
          transport: "stdio",
          command: process.execPath,
          args: [tsxCli, path.join(mcpDir, "server.ts")],
          stderr: "inherit"
        }
      }
    });

    const tools = await client.getTools();
    return {
      tools,
      close: () => client.close()
    };
  } catch (error) {
    throw layerError("MCP connection failed", error);
  }
}
