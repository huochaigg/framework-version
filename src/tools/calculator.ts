import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 菜单：name / description / schema 会通过 bindTools 发给模型。
 * 厨房：真正做运算的是这段 JS。模型看不到源码。
 */
export const calculator = tool(
  ({ a, b, operation }) => {
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
      throw new Error("除数不能为 0");
    }

    return { result: a / b };
  },
  {
    name: "calculator",
    description:
      "对两个数字做加减乘除。用户问算术、乘除加减时必须调用，不要自己心算。",
    schema: z.object({
      a: z.coerce.number().describe("第一个数字"),
      b: z.coerce.number().describe("第二个数字"),
      operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("运算类型")
    })
  }
);
