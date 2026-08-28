import { printError } from "../config/llm";
import { calculator } from "../tools/calculator";
import { getCurrentTime } from "../tools/current-time";

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
 * 「模型决定调用哪个 Tool → 执行 → 再把结果发给模型」放到 V23。
 */

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
    console.log("下一步是 V23：把这两个 Tool bind 到模型上，让模型自己决定调哪一个。");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
