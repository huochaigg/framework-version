import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getRuntimeInfo = tool(
  () => ({
    node: process.version,
    platform: process.platform,
    arch: process.arch
  }),
  {
    name: "getRuntimeInfo",
    description:
      "返回当前 Node.js 版本、操作系统和 CPU 架构。用户问运行环境、Node 版本时调用。",
    schema: z.object({})
  }
);
