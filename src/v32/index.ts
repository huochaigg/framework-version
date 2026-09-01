import { printError } from "../config/llm";
import { startServer } from "./server/app";

try {
  await startServer();
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
