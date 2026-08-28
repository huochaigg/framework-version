import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 时间是外部环境信息。模型训练完成后并不知道此刻几点。
 * 必须由 Node 执行 new Date()，再把结果作为 ToolMessage 加回 messages。
 */
export const getCurrentTime = tool(
  ({ timezone }) => {
    const now = new Date();

    return {
      timezone,
      iso: now.toISOString(),
      localTime: now.toLocaleString("zh-CN", {
        timeZone: timezone,
        hour12: false
      })
    };
  },
  {
    name: "getCurrentTime",
    description:
      "按指定时区返回当前时间。用户问现在几点、某地时间时必须调用。timezone 用 IANA 名称，例如 Asia/Tokyo、Asia/Shanghai。",
    schema: z.object({
      timezone: z.string().describe("IANA 时区，例如 Asia/Tokyo")
    })
  }
);
