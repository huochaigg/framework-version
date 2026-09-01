import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentTime = tool(
  ({ timezone }) => {
    try {
      const now = new Date();
      return {
        timezone,
        iso: now.toISOString(),
        localTime: now.toLocaleString("zh-CN", {
          timeZone: timezone,
          hour12: false
        })
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { error: `getCurrentTime failed: ${detail}` };
    }
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
