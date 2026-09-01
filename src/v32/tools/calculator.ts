import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const calculator = tool(
  ({ a, b, operation }) => {
    try {
      if (operation === "add") {
        return { result: a + b };
      }

      if (operation === "subtract") {
        return { result: a - b };
      }

      if (operation === "multiply") {
        return { result: a * b };
      }

      if (b === 0) {
        return { error: "除数不能为 0" };
      }

      return { result: a / b };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { error: `calculator failed: ${detail}` };
    }
  },
  {
    name: "calculator",
    description:
      "对两个数字做加减乘除。用户问算术时必须调用，不要自己心算。",
    schema: z.object({
      a: z.coerce.number().describe("第一个数字"),
      b: z.coerce.number().describe("第二个数字"),
      operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("运算类型")
    })
  }
);
