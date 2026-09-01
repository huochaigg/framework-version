import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { lastModelAnswer, usedToolNamesThisTurn } from "../agent/trace";
import {
  createAgentRuntime,
  prepareTurn,
  type CompiledAgentGraph
} from "../agent/graph";
import { V32_PORT } from "../config";
import { iterateAgentUiEvents } from "./events";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

function writeSse(res: express.Response, eventName: string, data: unknown) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createApp(graph: CompiledAgentGraph) {
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res
      .type("html")
      .send(fs.readFileSync(path.join(publicDir, "index.html"), "utf8"));
  });

  app.post("/api/chat", async (req, res) => {
    const conversationId = String(req.body?.conversationId ?? "");
    const message = String(req.body?.message ?? "").trim();

    if (!message) {
      res.status(400).json({ error: "message 不能为空" });
      return;
    }

    try {
      // 打断点：用户输入即将进入 graph.invoke。
      const { input, config, threadId } = await prepareTurn(
        graph,
        conversationId,
        message
      );
      const result = await graph.invoke(input, config);
      res.json({
        conversationId: threadId,
        answer: lastModelAnswer(result.messages),
        tools: usedToolNamesThisTurn(result.messages)
      });
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: err });
    }
  });

  app.get("/api/chat/stream", async (req, res) => {
    const conversationId = String(req.query.conversationId ?? "");
    const message = String(req.query.message ?? "").trim();

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    if (!message) {
      writeSse(res, "error", { message: "message 不能为空" });
      res.end();
      return;
    }

    try {
      // 打断点：用户输入即将进入 graph.streamEvents。
      const { input, config } = await prepareTurn(graph, conversationId, message);

      for await (const event of iterateAgentUiEvents(graph, input, config)) {
        // 打断点：Graph Stream 在这里变成 SSE。
        if (event.type === "status") {
          writeSse(res, "status", { status: event.status });
          continue;
        }

        if (event.type === "tool") {
          writeSse(res, "tool", { name: event.name });
          continue;
        }

        if (event.type === "token") {
          writeSse(res, "token", { token: event.token });
          continue;
        }

        if (event.type === "done") {
          writeSse(res, "done", {});
          continue;
        }

        writeSse(res, "error", { message: event.message });
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      writeSse(res, "error", { message: err });
    } finally {
      res.end();
    }
  });

  return app;
}

export async function startServer() {
  const runtime = await createAgentRuntime();
  const app = createApp(runtime.graph);

  const server = app.listen(V32_PORT, () => {
    console.log(`V32 AI Developer Assistant  http://127.0.0.1:${V32_PORT}`);
    console.log(`POST /api/chat`);
    console.log(`GET  /api/chat/stream?conversationId=&message=`);
  });

  const shutdown = async () => {
    server.close();
    await runtime.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}
