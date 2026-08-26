import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { printError } from "../config/llm";

/**
 * Demo 7：Tool
 *
 * 手写 V6：
 *   1. 写一份 Tool Definition（菜单，发给模型看）
 *   2. 再写一个 JS 函数（厨房，Node 里真正执行）
 *   3. 自己把 arguments JSON.parse 后再调用函数
 *
 * LangChain：
 *   tool() + Zod Schema 把「菜单」和「厨房」写在一起。
 *
 * 本 Demo 只做：
 *   定义 Tool → 直接 tool.invoke() → 打印结果
 *
 * 不要让模型选择 Tool。
 * 不要写 Agent Loop。
 * 「模型决定调用哪个 Tool → 执行 → 再把结果发给模型」放到后续版本。
 */

const calculator = tool(
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
    description: "对两个数字做加减乘除。",
    schema: z.object({
      a: z.number().describe("第一个数字"),
      b: z.number().describe("第二个数字"),
      operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("运算类型")
    })
  }
);

const getCurrentTime = tool(
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
    description: "按指定时区返回当前时间。",
    schema: z.object({
      timezone: z.string().describe("IANA 时区，例如 Asia/Shanghai")
    })
  }
);

async function main() {
  try {
    console.log("========== Tool 是什么 ==========\n");
    console.log("name / description / schema ≈ 以前发给模型的 Tool Definition（菜单）");
    console.log("函数体 ≈ 以前 Node 里真正执行的 JS 函数（厨房）");
    console.log("现在用 tool() 写在一处。本 Demo 不把菜单发给模型。\n");

    console.log("calculator.name =", calculator.name);
    console.log("calculator.description =", calculator.description);
    console.log("");

    console.log("========== 直接 invoke calculator ==========\n");

    // 打断点建议：停在 invoke，确认走的是本地 JS，没有 HTTP 请求
    const sum = await calculator.invoke({
      a: 12,
      b: 4,
      operation: "add"
    });
    const quotient = await calculator.invoke({
      a: 12,
      b: 4,
      operation: "divide"
    });

    console.log("12 + 4 =", sum);
    console.log("12 / 4 =", quotient);
    console.log("");

    console.log("========== 直接 invoke getCurrentTime ==========\n");

    const shanghaiTime = await getCurrentTime.invoke({
      timezone: "Asia/Shanghai"
    });
    const newYorkTime = await getCurrentTime.invoke({
      timezone: "America/New_York"
    });

    console.log("Asia/Shanghai：", shanghaiTime);
    console.log("America/New_York：", newYorkTime);
    console.log("");
    console.log("下一步才会学：把这两个 Tool bind 到模型上，让模型自己决定调哪一个。");
    console.log("那是 Agent Loop / LangGraph 的事，本版本故意停在这里。");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
