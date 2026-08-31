import express from "express";
import { printError } from "../config/llm";
import { DEMO_QUESTION, createAnalyzeAnswerGraph, textFromModel } from "./shared";

/**
 * V30-5 · Graph Stream → HTTP SSE
 *
 * SSE 不是 LangGraph 的功能，只是 Browser ↔ Server 的传输协议。
 * LangGraph stream 是 Server 内部 Graph 执行过程的数据来源。
 *
 * 手写 V13：LLM Stream → res.write()
 * 本 Demo：Graph stream/event → SSE → Browser
 *
 * 不做 EventSource 自动重连、Last-Event-ID、后台 Run、数据库、Redis。
 */

const PORT = 3000;

const PAGE = `<!doctype html>
<meta charset="utf-8" />
<title>V30 SSE</title>
<p>
  <input id="q" size="48" value="${DEMO_QUESTION}" />
  <button id="go">发送</button>
</p>
<pre id="out"></pre>
<script>
  const out = document.getElementById("out");
  const q = document.getElementById("q");
  let source;
  document.getElementById("go").onclick = () => {
    if (source) source.close();
    out.textContent = "";
    source = new EventSource("/api/chat/stream?question=" + encodeURIComponent(q.value));
    source.addEventListener("status", (e) => {
      out.textContent += "[status] " + JSON.parse(e.data).status + "\\n";
    });
    source.addEventListener("token", (e) => {
      out.textContent += JSON.parse(e.data).token;
    });
    source.addEventListener("done", () => {
      out.textContent += "\\n[done]";
      source.close();
    });
    source.addEventListener("error", (e) => {
      if (!e.data) return;
      out.textContent += "\\n[error] " + JSON.parse(e.data).message;
      source.close();
    });
  };
</script>`;

type MessageChunk = { content?: unknown };
type MessageMeta = { langgraph_node?: string };

function writeSse(res: express.Response, eventName: string, data: unknown) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function main() {
  const app = express();
  const graph = createAnalyzeAnswerGraph();

  app.get("/", (_req, res) => {
    res.type("html").send(PAGE);
  });

  app.get("/api/chat/stream", async (req, res) => {
    const question = String(req.query.question ?? "").trim() || DEMO_QUESTION;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      writeSse(res, "status", { status: "analyzing" });

      const stream = await graph.stream(
        { question },
        { streamMode: ["updates", "messages"] }
      );

      for await (const [mode, chunk] of stream) {
        // 打断点 5：Graph Stream 数据在这里变成 res.write
        if (mode === "updates") {
          const update = chunk as Record<string, unknown>;
          if ("analyze" in update) {
            writeSse(res, "status", { status: "answering" });
          }
          continue;
        }

        if (mode === "messages") {
          const [message, metadata] = chunk as [MessageChunk, MessageMeta];
          if (metadata.langgraph_node !== "generateAnswer") {
            continue;
          }

          const token = textFromModel(message.content);
          if (token) {
            writeSse(res, "token", { token });
          }
        }
      }

      writeSse(res, "done", {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      writeSse(res, "error", { message });
    } finally {
      res.end();
    }
  });

  app.listen(PORT, () => {
    console.log(`打开 http://127.0.0.1:${PORT}`);
    console.log(
      `或 curl -N "http://127.0.0.1:${PORT}/api/chat/stream?question=${encodeURIComponent(DEMO_QUESTION)}"`
    );
  });
}

main().catch((error) => {
  printError(error);
  process.exitCode = 1;
});
