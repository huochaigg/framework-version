import { printError } from "../config/llm";
import { createPostgresCheckpointer } from "./shared";

/**
 * V29 · 初始化 PostgreSQL Checkpointer 表
 *
 * 第一次使用 PostgresSaver 必须调用官方 setup()。
 * 它会创建 / 迁移官方表，不要自己设计 checkpoint 表结构。
 *
 * 之后再分别跑：v29-save、v29-resume、v29-threads。
 */
async function main() {
  const checkpointer = createPostgresCheckpointer();

  try {
    await checkpointer.setup();
    console.log("Checkpointer 表已初始化");
    console.log("接下来可以跑 pnpm v29-save");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  } finally {
    await checkpointer.end();
  }
}

await main();
