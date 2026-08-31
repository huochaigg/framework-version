# V21 · LangChain Fundamentals 学习笔记

这不是产品文档。这是从「手写 Agent」跨进「框架」的第一课。

对应手写项目：`D:\learn\agent\MyProject\`（V1～V20）

本仓库是全新独立项目。**不要改原来的手写代码。** 参考项目只用于对照，新代码只写在本仓库。

当前做到 **V31**。V21 组件，V22 Graph，V23 Agent Loop，V24 Memory + Checkpoint，V25 Agentic RAG，V26 Advanced Agentic RAG，V27 Advanced RAG（Rerank / Multi Query / HyDE），V28 Human in the Loop，V29 Persistence / Production Checkpoint，V30 Streaming，V31 MCP + LangGraph。没有长期记忆、真实 pgvector、远程 HTTP MCP、复杂前端。

---

## 这堂课在学什么

手写阶段你已经自己实现过：

- 调模型（V1 / V2）
- 拼 messages（V4）
- 拼 Prompt 字符串（全程）
- JSON.parse + 自己校验（V5）
- Tool Definition + JS 函数（V6）

LangChain 没有取消这些步骤。它把每一步收成统一接口：

```text
Prompt / Messages / Model / Parser / Tool
都是 Runnable
都可以 invoke()
可以用 pipe() 接起来
```

学完 V21，你应该能回答：

1. `ChatOpenAI` 底下是不是还在发 HTTP？
2. `SystemMessage` 和 `role: "system"` 差在哪？
3. `pipe` 到底接了什么？
4. Parser 和 Structured Output 不是一回事
5. `tool()` 现在只是定义能力，还不是 Agent

---

## 开始之前

```bash
cd D:\learn\agent\framework-version
pnpm install
copy .env.example .env
```

编辑 `.env`：

```bash
LLM_API_KEY=你的key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

阿里云百炼示例：

```bash
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
```

模型初始化只放在 `src/config/llm.ts`。每个 Demo 都复用它。

如果你已经跑过手写项目 `D:\learn\agent\MyProject\`，可以把那边的 `DEEPSEEK_API_KEY` 填到 `LLM_API_KEY`，`LLM_BASE_URL` 用 `https://api.deepseek.com`，`LLM_MODEL` 用 `deepseek-chat`。跑 V25 以后再填 `EMBEDDING_*`。跑 V29 的 PostgreSQL Demo 再填 `POSTGRES_URL`。

---

## 推荐阅读 / 运行顺序

严格按编号走。后面的 Demo 建立在前面的概念上。

| 顺序 | 命令 | 文件 | 先搞懂什么 |
| --- | --- | --- | --- |
| 1 | `pnpm demo:chat` | `src/demos/01-chat-model.ts` | invoke vs stream |
| 2 | `pnpm demo:messages` | `src/demos/02-messages.ts` | 三种 Message 类 |
| 3 | `pnpm demo:prompt` | `src/demos/03-prompt-template.ts` | 变量怎么填进 Prompt |
| 4 | `pnpm demo:lcel` | `src/demos/04-lcel.ts` | **本课重点：pipe** |
| 5 | `pnpm demo:parser` | `src/demos/05-output-parser.ts` | 解析发生在模型之后 |
| 6 | `pnpm demo:structured` | `src/demos/06-structured-output.ts` | Zod + 类型 + 运行时校验 |
| 7 | `pnpm demo:tool` | `src/demos/07-tool.ts` | 只定义和执行 Tool，不让模型选 |
| 8 | `pnpm v22` | `src/v22/langgraph-basic.ts` | State / Node / Edge / Graph |
| 9 | `pnpm v23` | `src/v23/agent-loop.ts` | Conditional Edge + ToolNode + 回边 |
| 10 | `pnpm v24` | `src/v24/memory-checkpoint.ts` | thread_id + Checkpointer |
| 11 | `pnpm v25` | `src/v25/agentic-rag.ts` | 普通 RAG vs Agentic RAG |
| 12 | `pnpm v26` | `src/v26/advanced-agentic-rag.ts` | Grade + Rewrite 循环 |
| 13 | `pnpm v27` | `src/v27/advanced-rag.ts` | Rerank / Multi Query / HyDE |
| 14 | `pnpm v28` | `src/v28/human-in-the-loop.ts` | interrupt / resume / 人工确认 |
| 15 | `pnpm v29-setup` | `src/v29/00-setup.ts` | 初始化 PostgreSQL Checkpointer 表 |
| 16 | `pnpm v29-memory` | `src/v29/01-memory-checkpoint.ts` | 内存 Checkpoint 对照 |
| 17 | `pnpm v29-save` | `src/v29/02-persistent-save.ts` | 写入 PostgreSQL 后退出 |
| 18 | `pnpm v29-resume` | `src/v29/03-persistent-resume.ts` | 新进程按 thread_id 恢复 |
| 19 | `pnpm v29-threads` | `src/v29/04-thread-isolation.ts` | thread 隔离 |
| 20 | `pnpm v30-values` | `src/v30/01-stream-values.ts` | streamMode values |
| 21 | `pnpm v30-updates` | `src/v30/02-stream-updates.ts` | streamMode updates |
| 22 | `pnpm v30-messages` | `src/v30/03-stream-messages.ts` | LLM token 流 |
| 23 | `pnpm v30-events` | `src/v30/04-stream-events.ts` | 执行事件流 |
| 24 | `pnpm v30-sse` | `src/v30/05-stream-sse.ts` | Graph Stream → SSE |
| 25 | `pnpm v31-server` | `src/v31/01-mcp-server.ts` | 只启动 MCP Server |
| 26 | `pnpm v31-client` | `src/v31/02-mcp-client.ts` | MCP Client：listTools / callTool |
| 27 | `pnpm v31-tools` | `src/v31/03-mcp-to-langchain-tools.ts` | MCP Tool → LangChain Tool |
| 28 | `pnpm v31-agent` | `src/v31/04-langgraph-mcp-agent.ts` | LangGraph Agent 调用 MCP Tool |
| 29 | `pnpm v31-multi-server` | `src/v31/05-multi-mcp-server.ts` | 一个 Agent 同时用两个 MCP Server |

看完目录后，先读 `src/config/llm.ts`，再按上面顺序打开 Demo。

---

## 1. Chat Model

**概念**

Chat Model 是 LangChain 对「聊天模型」的统一封装。你调用的是 `model.invoke()` / `model.stream()`，不再直接写 `openai.chat.completions.create`。

**对应手写版本**

- V1：`client.chat.completions.create({ stream: false })`
- V2：`client.chat.completions.create({ stream: true })` + `for await` 读 `delta.content`

**LangChain 替你封装了什么**

- OpenAI SDK 的 client 创建
- `messages` 既可传字符串，也可传 Message 对象
- 不同厂商尽量同一套调用方式
- 返回值统一成 `AIMessage` / `AIMessageChunk`

**底层仍然存在的逻辑**

- 仍然是 HTTP 请求
- 仍然要 API Key、baseURL、model
- `invoke` 仍然等完整结果；`stream` 仍然按 token/chunk 推
- 换 DeepSeek / 百炼，靠的还是 OpenAI Compatible API

**以后在 LangGraph / Agent 里怎么用**

Agent 的「思考节点」最终还是在调 Chat Model。Graph 不会换成另一种模型协议，只是多次 `invoke`，中间插入 Tool 结果。

---

## 2. Messages

**概念**

一次模型调用看到的输入，是一组有角色的消息。LangChain 用类来表示角色：

- `SystemMessage`
- `HumanMessage`
- `AIMessage`

**对应手写版本**

V4 的：

```ts
{ role: "system", content: "..." }
{ role: "user", content: "..." }
{ role: "assistant", content: "..." }
```

**LangChain 替你封装了什么**

- 角色变成类型，少写错 `"sysem"` 这种字符串
- 以后还能挂 tool_calls、图片等内容块
- `model.invoke(messages)` 接受这组对象

**底层仍然存在的逻辑**

- 模型依然没有记忆
- 多轮 = 每次把历史数组再发一遍
- 本 Demo 的数组只在内存里，进程结束就消失
- 没有数据库，也不是 V8 Memory

**以后在 LangGraph / Agent 里怎么用**

Graph 的 state 里通常就有 `messages: BaseMessage[]`。Reducer 负责 append。本质仍是这个数组，只是存到了 Graph 状态里。

---

## 3. PromptTemplate / ChatPromptTemplate

**概念**

把 Prompt 从「临时拼的模板字符串」变成「可复用、带变量的对象」。

- `PromptTemplate`：产出一段文本
- `ChatPromptTemplate`：产出一组 Chat Messages（更适合 Chat Model）

**对应手写版本**

你以前到处写的：

```ts
const prompt = `你是一名${level}导师，请解释 ${technology} 的 ${question}`;
```

以及 V5 里那一大段 `STRUCTURED_SYSTEM_PROMPT`。

**LangChain 替你封装了什么**

- `{variable}` 占位符
- `invoke({ technology, level, question })` 填空
- Chat 场景下直接得到 messages，不必自己拼 role

**底层仍然存在的逻辑**

- 填完之后，发给模型的还是纯文本 / 消息数组
- 模板不会调用模型
- 变量名写错，运行时才会发现

**以后在 LangGraph / Agent 里怎么用**

Agent 的 system prompt、每个节点自己的 prompt，都可以是 ChatPromptTemplate。输入变成 Graph state 里的字段。

---

## 4. LCEL（本课重点）

**概念**

LCEL = 用统一的 Runnable 接口把步骤接起来。

Runnable 的共同点：有 `invoke()`。  
`pipe` 的含义：上一步输出，自动变成下一步输入。

```ts
const chain = prompt.pipe(model).pipe(parser);
const text = await chain.invoke({ question: "LCEL 是什么？" });
```

**对应手写版本**

```text
buildPrompt()
  → callLLM()
  → parseResult()
```

**LangChain 替你封装了什么**

- 不必自己把 PromptValue 传给 model、再把 AIMessage 传给 parser
- `chain.invoke(input)` 一次走完
- 以后同一套接口还能 `stream` / `batch`

**底层仍然存在的逻辑**

打开 `04-lcel.ts`，先看拆开的三步，再看 `pipe`。  
`pipe` 没有消灭这三步，只是帮你接线。

Chain ≠ Agent。  
Agent 是「模型可能多次决定调用 Tool」。  
Chain 是「你预先排好的流水线，方向固定」。

**以后在 LangGraph / Agent 里怎么用**

LangGraph 的节点内部，经常就是一条小 Chain。Graph 负责循环和分支；LCEL 负责单个节点里的数据流。

---

## 5. Output Parser

**概念**

Parser 在模型**之后**工作。它不发请求，只转换数据。

- `StringOutputParser`：`AIMessage` → `string`
- `JsonOutputParser`：模型文本 → JavaScript 对象

**对应手写版本**

```ts
const content = completion.choices[0].message.content;
const data = JSON.parse(content);
```

**LangChain 替你封装了什么**

- 从 `AIMessage` 里取 content
- JSON 可能夹在 markdown 代码块里，Parser 会尽量抽出对象
- 可以 `pipe` 到 Chain 末尾

**底层仍然存在的逻辑**

- 模型吐出的首先仍是文本
- `JSON.parse` 成功 ≠ 业务字段正确
- 没有 Zod 的话，多一个字段、少一个字段、枚举写错，Parser 不一定报错

**以后在 LangGraph / Agent 里怎么用**

需要「给用户看的纯文本」时，节点末尾接 `StringOutputParser`。  
需要「给下游节点用的对象」时，更推荐 Structured Output，而不是只靠 JSON.parse。

---

## 6. Structured Output

**概念**

先用 Zod 声明「我要什么形状的对象」，再让模型按这个形状返回。TypeScript 类型可以从 Schema `infer` 出来，运行时也会校验。

本 Demo 用的是当前推荐写法：`model.withStructuredOutput(zodSchema)`。

对 DeepSeek / 百炼这类 OpenAI Compatible 接口，需要显式写 `method: "functionCalling"`。  
ChatOpenAI 看到模型名不是 `gpt-3` / `gpt-4` 时，会默认走 `jsonSchema`，这些厂商通常还不支持。

**对应手写版本**

V5：

```text
规定 JSON 的 Prompt
→ response_format: json_object
→ JSON.parse
→ isKnowledgeAnalysis() 手写校验
```

**LangChain 替你封装了什么**

- Schema 同时当：给模型的格式说明、给 TS 的类型、给运行时的校验器
- 尽量走模型原生 Structured Output / Tool Calling，而不是「请你一定输出 JSON」再碰运气
- 校验失败会抛错，而不是 `as SomeType` 骗过编译器

**底层仍然存在的逻辑**

- 模型仍可能给错数据，所以才要 runtime validation
- 兼容接口（DeepSeek / 百炼）不一定支持 OpenAI 最新的 json_schema，LangChain 会退到 function calling 等路径
- 这仍然不是 Tool Calling Agent：没有「去执行外部函数再思考」

**以后在 LangGraph / Agent 里怎么用**

路由决策、抽取字段、结束时的结构化答案，都可以 `withStructuredOutput`。Agent 要的是稳定对象，不是一篇 Markdown。

---

## 7. Tool

**概念**

Tool = 给模型看的菜单 + Node 里真正执行的函数。

LangChain 用 `tool()` + Zod Schema 写在一处：

- `name` / `description` / `schema` ≈ 菜单
- 函数体 ≈ 厨房

**对应手写版本**

V6 的 `GET_CURRENT_TIME_TOOL` 定义，加上 `getCurrentTime()` / `calculate()` 实现。

**LangChain 替你封装了什么**

- Schema 用 Zod 写，不必手写 JSON Schema
- `tool.invoke(args)` 会按 Schema 校验参数再执行
- 以后 `model.bindTools([calculator, getCurrentTime])` 时，菜单就是从这里来的

**底层仍然存在的逻辑**

- 工具函数仍然是你写的 JS
- 模型默认看不见函数源码
- **本 Demo 没有把 Tool 交给模型**
- 没有「模型选择 Tool → 执行 → 再发给模型」的循环

**以后在 LangGraph / Agent 里怎么用**

那才是 Tool Calling + Agent Loop：模型输出 tool_calls，运行时执行对应 Tool，把 ToolMessage 追加进 messages，再 `invoke` 一次。V21 只准备好 Tool 对象。

---

## 手写版本 ↔ LangChain 映射表

| 手写项目里的东西 | LangChain 对应物 |
| --- | --- |
| OpenAI SDK `chat.completions.create` | Chat Model / `model.invoke()` |
| `stream: true` + `delta.content` | `model.stream()` |
| `role: "system"` / `"user"` / `"assistant"` | `SystemMessage` / `HumanMessage` / `AIMessage` |
| 模板字符串 `` `...${var}` `` | `PromptTemplate` / `ChatPromptTemplate` |
| `buildPrompt()` → `callLLM()` → `parse()` | LCEL：`prompt.pipe(model).pipe(parser)` |
| `JSON.parse` | Output Parser |
| JSON + 手写 `validate` | Structured Output + Zod（`withStructuredOutput`） |
| Tool Definition + JS Function | `tool()` + Zod Schema |
| while 循环里决定是否调 Tool | **不是 V21**，留给后续 Agent / LangGraph |

---

## 目录

```text
src/
  config/llm.ts              唯一的模型初始化
  demos/01-chat-model.ts
  demos/02-messages.ts
  demos/03-prompt-template.ts
  demos/04-lcel.ts           最值得慢慢看
  demos/05-output-parser.ts
  demos/06-structured-output.ts
  demos/07-tool.ts
  v22/langgraph-basic.ts     V22 最小 Graph
  v23/agent-loop.ts          V23 Agent Loop
  v23/create-agent-graph.ts  V23 / V24 共用 Graph
  v24/memory-checkpoint.ts   V24 Memory + Checkpoint
  v25/agentic-rag.ts         V25 Agentic RAG
  v26/advanced-agentic-rag.ts V26 Advanced Agentic RAG
  v27/advanced-rag.ts        V27 Advanced RAG
  v28/human-in-the-loop.ts   V28 Human in the Loop
  v29/00-setup.ts            V29 初始化 Checkpointer 表
  v29/01-memory-checkpoint.ts
  v29/02-persistent-save.ts
  v29/03-persistent-resume.ts
  v29/04-thread-isolation.ts
  v29/shared.ts              V29 极简 Chat Graph
  v30/shared.ts              V30 极简 Analyze/Answer Graph
  v30/01-stream-values.ts
  v30/02-stream-updates.ts
  v30/03-stream-messages.ts
  v30/04-stream-events.ts
  v30/05-stream-sse.ts
  v31/shared.ts              V31 共用：stdio 启动参数 / 模拟 Tool 实现
  v31/01-mcp-server.ts       同时暴露 calculator + getUserInfo
  v31/02-mcp-client.ts
  v31/03-mcp-to-langchain-tools.ts
  v31/04-langgraph-mcp-agent.ts
  v31/05-multi-mcp-server.ts
  v31/calculator-server.ts   仅 calculator，给 multi-server 用
  v31/user-server.ts         仅 getUserInfo，给 multi-server 用
  rag/knowledge.ts
  rag/store.ts
  rag/rerank.ts
  rag/multi-query.ts
  rag/hyde.ts
  rag/preview.ts
  config/embedding.ts
  tools/calculator.ts
  tools/current-time.ts
  tools/transfer-money.ts
  index.ts                   打印学习顺序
```

每个 Demo 都可以单独运行。出问题会 `try/catch` 并打印原因。

---

## 本版本明确不做

- 长期用户记忆 / 跨 thread 画像
- 真实 PostgreSQL + pgvector
- 第三方 Rerank API（Cohere / Jina）、Elasticsearch、BM25 / Hybrid Search
- Retriever 包装成 Tool
- Web Search fallback / Corrective RAG 外部搜索
- Self-RAG Token / 多 Agent
- 远程 HTTP MCP / OAuth / 复杂 Streaming 前端
- time travel
- Redis Checkpointer / MySQL / BullMQ
- React UI

V25 只做到「是否检索」。V26 加上 Grade + Query Rewrite 有限循环。V27 学习 Rerank / Multi Query / HyDE。V28 学习 interrupt / resume。V29 学习 PostgreSQL Checkpointer。V30 学习 Streaming / SSE。V31 学习把 MCP Tool 接进 LangGraph Agent。知识库仍是内存文本，不是生产向量库。

---

## 最值得打断点的 5 个位置

不要平均撒断点。V21 里这 5 处最能看见「框架底下还在干什么」。

1. `src/config/llm.ts` → `new ChatOpenAI({...})`  
   看 `apiKey` / `baseURL` / `model` 如何进 Chat Model。对应手写项目的 `new OpenAI({ apiKey, baseURL })`。

2. `src/demos/01-chat-model.ts` → `model.invoke()` 和 `model.stream()`  
   对比一次返回完整 `AIMessage`，和 `for await` 里每个 chunk 只有一小段文本。

3. `src/demos/02-messages.ts` → `model.invoke(conversation)`  
   展开 `conversation`，确认 `AIMessage`（上一轮回答）也被带上。模型没有记忆，全靠这次数组。

4. `src/demos/04-lcel.ts` → `prompt.pipe(model).pipe(parser)` 以及 `chain.invoke()`  
   **本课最重要的断点。** Step Into 看数据如何从 PromptValue → AIMessage → string。`pipe` 只是接线，没有消灭那三步。

5. `src/demos/06-structured-output.ts` → `withStructuredOutput(...)` 和后面的 `invoke`  
   看 Zod Schema 如何变成一次 Structured Output 调用，返回值已经是对象而不是 JSON 字符串。  
   对比 `src/demos/07-tool.ts` 的 `calculator.invoke()`：那里完全不发 HTTP，走的是本地 JS。

---

## V22 · LangGraph Fundamentals

一句话：**LangGraph = 用 State 保存过程数据，用 Node 做事情，用 Edge 决定下一步，最后把整个 AI 流程组织成 Graph。**

- **State** = 数据。整个 Graph 执行期间，多个 Node 共享这一份。
- **Node** = 步骤。读 State，做事（这里是调 Chat Model），返回要更新的字段。
- **Edge** = 流转关系。这一版只有普通边，顺序固定。
- **Graph** = 完整流程。`START → analyzeQuestion → generateAnswer → END`

运行：`pnpm v22`

| 手写版 | LangGraph |
| --- | --- |
| `const state = { question, analysis, answer }` | State |
| `analyzeQuestion()` / `generateAnswer()` | Node |
| `await analyze(); await generate();` | Edge |
| 整个流程函数 | Graph |

---

## V23 · LangGraph Agent Loop

一句话：手写 Agent Loop 就是「模型节点 + 工具节点 + 条件判断 + 回边循环」，LangGraph 把它显式建模成 Graph。

运行：`pnpm v23`

| 手写 V7 | LangGraph |
| --- | --- |
| `while (true)` | Graph 回边 `tools → callModel` |
| `if (tool_calls)` | Conditional Edge |
| `executeTool()` | ToolNode |
| `messages.push(...)` | Messages State 更新 |
| `break` | END |
| 整个 `runAgent()` | compiled Graph |

---

## V24 · LangGraph Memory + Checkpoint

一句话：模型没有突然拥有记忆。是 `thread_id + checkpointer` 保存并恢复之前的 State，下一次调用才能看到旧 messages。

- **State** = 当前 Graph 运行中的数据
- **Checkpoint** = 整个 Graph State 的快照（不只是聊天记录）
- **thread_id** = 找到对应会话状态的标识，不是 userId
- **Memory** = 利用历史 State 形成的连续对话效果

运行：`pnpm v24`

| 手写版 | LangGraph |
| --- | --- |
| `conversationId + getMessages()` | `thread_id + checkpointer` |
| `saveMessages()` | Checkpoint 自动保存 |
| 手动加载历史 messages | Checkpoint 自动恢复 State |

---

## V25 · LangGraph RAG / Agentic RAG

一句话：普通 RAG 是固定流程；Agentic RAG 是让模型参与「要不要检索、接下来走哪条路径」。LangGraph 的价值不是替我做 embedding，而是把判断、检索、生成、分支组织成可控制的工作流。

- 普通 RAG：`Question → Retrieve → Generate`
- Agentic RAG：`Question → Decide → Retrieve 或 Direct → Generate`

V23 的 Conditional Edge 判断有没有 Tool Call；V25 判断要不要走 RAG。

真实项目里还有另一种做法：把 Retriever 包装成 Tool，让 Agent 自己决定是否调用检索。这一版用 Node + Conditional Edge 就够了。

运行：`pnpm v25`

需要额外配置 Embedding：`EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL`

| 手写 V17 | LangGraph |
| --- | --- |
| `vectorSearch()` | Retriever / VectorStore.similaritySearch |
| `if (needRag)` | Conditional Edge |
| `buildContext()` | RAG Node 里组织 Documents |
| 整个 RAG pipeline | Graph 上的多个 Node |

---

## V26 · LangGraph Advanced Agentic RAG

一句话：Agentic RAG 不只是「Agent 可以调用向量库」。更重要的是模型能参与 RAG 流程中的决策：要不要检索、检索结果有没有用、要不要改写问题、什么时候停止重试。

V25 只有分支。V26 开始真正出现判断 + 回退 + 循环。LangGraph 适合复杂 RAG，正是因为这些决策可以写成 Node + Conditional Edge + 回边，而不必在 Graph 外面手写 `while`。

### 三种 RAG 差在哪

| 版本 | 流程 |
| --- | --- |
| 普通 RAG | `retrieve → generate` |
| V25 Agentic RAG | `decide → retrieve / direct → generate` |
| V26 Advanced Agentic RAG | `decide → retrieve → grade → rewrite / retrieve → generate / fallback` |

### 为什么 similarity score 不等于「文档一定有用」

向量距离只能说明语义相近程度。相近不等于文档真包含回答当前问题所需的信息。Retriever 负责「找相似」；Grader 负责「这些内容能不能回答问题」。两者职责不同，所以不能只看 similarity score 或关键词命中。

### 为什么需要 Query Rewrite

用户的问题是为了交流而写的，常常有代词、省略、口语。Retriever 更喜欢明确的语义检索表达。例如「那个图框架是怎么记住我上一句话的？」改写成「LangGraph checkpointer thread_id conversation memory」后，更容易命中知识库里的英文条目。

### 手写版映射

循环逻辑必须写在 Graph Edge 里，不要在 Graph 外面再套一层 `while`。

| 手写逻辑 | LangGraph |
| --- | --- |
| `if (needRag)` | `decideRoute` + Conditional Edge |
| `docs = search(query)` | `retrieveKnowledge` Node（用当前 `query`，不是永远用原问题） |
| `if (docsRelevant)` | `gradeDocuments` + Conditional Edge |
| `query = rewriteQuery(query)` | `rewriteQuery` Node |
| `while (!relevant)` | Graph 回边：`rewriteQuery → retrieveKnowledge` |
| `maxRetry` | State 里的 `rewriteCount`，达到上限走 `fallbackAnswer` |

运行：`pnpm v26`

打断点建议：

1. 第一次进入 `retrieveKnowledge` 时的 `query`
2. 第一次检索完成后的 `retrievedDocs`
3. `gradeDocuments` 返回 `relevant` / `irrelevant`
4. `rewriteQuery` 执行前后的 `query` 对比
5. 第二次 retrieve 确认用的是改写后的 query
6. `rewriteCount` 达到限制后 Conditional Edge 如何进入 fallback

---

## V27 · Advanced RAG Techniques

一句话：**只靠一次向量 TopK 往往不够。** 语义相似不等于最适合回答；一种问法也可能漏召回。V27 不继续扩 Agent Loop，专门看检索质量。

运行：`pnpm v27`

改 `src/v27/advanced-rag.ts` 里的 `STRATEGY` 可以只跑一种策略。默认 `all`，用两个问题对照：

- `LangGraph 是怎么记住前面对话，并在下一次调用时恢复状态的？`
- `那个图框架怎么知道我刚才说过什么？`

知识库太小时，结果差异可能不明显。这一版不要求证明谁一定更准，重点是看每种方法改了 RAG 的哪一环。

### 四种方法分别改了哪一环

| 方法 | 它做了什么 | 解决什么 |
| --- | --- | --- |
| Baseline RAG | 原问题直接检索 | 对照组：Question → Embedding → TopK → Documents |
| Multi Query | 一个问题变成多个 Query | **提高 Recall（召回）**：减少「一种说法漏掉相关文档」 |
| HyDE | 问题先变成假设文档，再检索 | 缩小「问题语言」和「文档语言」的结构差异 |
| Rerank | 对已经召回的候选重新精排 | **提高 Precision（精确）**：语义相似 ≠ 最适合回答 |

**Multi Query 提高 Recall，Rerank 提高 Precision。** 两者不是同一个东西。Multi Query 解决「召回不足」；Rerank 解决「已经召回的候选排序不够准」。

常见组合是 `multi-query + rerank`，入口里单独有这一项。不要把 HyDE + Multi Query + Rerank + Grade + Rewrite 一次全跑，那样又看不清重点。

### RAG 优化处在哪一层

以后看到任何 RAG 技巧，先问它属于哪一层：

| 阶段 | 做什么 | 例子 |
| --- | --- | --- |
| 检索前 | 改「拿什么去搜」 | Query Rewrite、Multi Query、HyDE |
| 检索中 | Embedding → Vector Search → TopK | 手写 V17 的 `searchSimilarChunks`，LangChain 的 `similaritySearch` |
| 检索后 | 改「留下哪些、什么顺序」 | Rerank、过滤、Grade |
| 生成 | Context + Question → LLM | `buildContext()` 之后才调模型 |

生产里常见的完整链路是：

```text
Question → Query Rewrite / Multi Query → Vector Search Top20 → Rerank Top5 → LLM Generate
```

V27 把这些环节拆开演示，而不是塞进一个超级 Graph。

### 对照手写 V17

参考项目：`D:\learn\agent\MyProject\`（只读，不要改那里的文件）

V17 的主路径是：

```text
question → embedQuery() → searchSimilarChunks(topK) → buildContext() → LLM
```

这就是最基础的 **Baseline RAG**。`vectorRetriever.ts` 里的 `vectorRetrieve()`，对应本仓库 `VectorStore.similaritySearch`。`rag.ts` 里的 context 拼接，对应 Generate 前把 Documents 拼进 Prompt。

V27 学的不是再写一遍 pgvector，而是：在这条基础流程的**检索前**和**检索后**加质量优化。检索阶段本身没变，仍然是 Embedding + Vector Search + TopK。这一版继续用 V25/V26 的 MemoryVectorStore，避免数据库干扰学习。

| 手写 V17 | 本仓库 |
| --- | --- |
| `embedQuery(question)` | VectorStore 内部 `embedQuery` |
| `searchSimilarChunks({ embedding, topK })` | `similaritySearch(query, k)` |
| `ORDER BY embedding <=> vector LIMIT k` | 语义相似度 TopK |
| `buildContext(chunks)` | 把最终 Documents 拼进 Prompt |
| 没有二次排序 | V27 Rerank：`Top10 → score → sort → Top3` |
| 只用原始 question 检索 | V27 Multi Query / HyDE 先改检索文本 |

LangChain 没有神奇改变底层原理。它只是 Retriever、Document、Runnable、Structured Output 让这套流程更容易组合。

### Baseline

用户问题 → Embedding → similarity search Top5 → Documents → Generate。

直接复用 V25/V26 的 `createKnowledgeStore()` + `similaritySearch`，不重写知识库初始化。只打印文档标题或前几十个字符，不打印 embedding 和 metadata dump。

### Rerank

Vector Search 的 TopK 是语义相似度排序。相近不等于这些文档一定最适合回答当前问题。

流程：`Retriever 先取 Top10 → LLM 给每篇 0～100 分 → 按分数排 → 取 Top3 → Generate`。

Reranker **只打分，不生成答案**。控制台会对比 Vector Top5 和 Rerank 后 Top3，排序可能变化。

手写版如果自己做，就是：`vectorSearch(topK=10) → scoreDocuments(question, docs) → sort → slice(0, 3)`。这一版用 LLM Structured Output，不接第三方 Rerank API。

### Multi Query

用户一句话只有一种表达，知识库里同一个概念可能有多种表达（中文、英文、实现细节）。只 embedding 原问题，可能漏召回。

流程：`Question → 生成 3 个 Query → 各检索 Top3 → Merge/Dedupe → Generate`。

不要生成 10～20 个 Query。组合演示才再交给 Rerank：`Question → Multi Query → 多次 Retrieve → Merge/Dedupe → Rerank → Generate`。

### HyDE（Hypothetical Document Embeddings）

HyDE 不是先 embedding 用户问题，而是先让 LLM 写一段「假设会出现在技术文档里的答案」，再对这段假设文档做 embedding 去检索真实知识库。

为什么可能有效：问题和文档的语言结构不同。先把问题变成「类似文档的表达」，检索更容易对上真实片段。

**风险：** 假设文档是模型生成的，可能包含错误。它只用于检索，不能当最终事实。最终回答必须基于真正检索到的 Documents。Prompt 要求只写 1～3 句文档摘录，不要长文。

### 打断点（按这个顺序看数据）

1. Baseline 使用原始 `question` 做 `similaritySearch` 的地方
2. Multi Query 生成三个 queries 后的结果
3. 三个 Query 分别检索，然后 Merge/Dedupe 后的 Documents
4. Rerank 前后的 Documents 顺序和 score
5. HyDE：原始 question → hypothetical document
6. HyDE 实际传给 VectorStore 的检索文本（确认不是原始问题）

看的是 question → query → docs → rerank docs → context → answer。不必细究 LangChain 源码。

### 这一版明确不做

- 第三方 Rerank API、Elasticsearch、BM25 / Hybrid Search
- 真实生产知识库、Web Search、PostgreSQL 持久化
- Agent Loop / Checkpoint / Human in the Loop
- React / SSE
- V28

---

## V28 · LangGraph Human in the Loop

一句话：**LangGraph Human in the Loop 的价值不是弹确认框，而是让一个有状态的 Agent 工作流可以安全暂停、保存现场、等待外部决策，然后从原来的位置继续。**

运行：`pnpm v28`

场景 2、3 会在命令行等你输入 `yes` 或 `no`。这只是 Demo 的输入方式。真正暂停 Graph 的是 `interrupt()`，真正恢复的是 `Command({ resume })`。

### 普通 Tool Calling vs Human in the Loop

| | 谁决定调用 | 谁执行 |
| --- | --- | --- |
| 普通 Tool Calling（V23） | Agent 自动决定 | 自动执行 |
| Human in the Loop（V28） | Agent 决定调用 | Graph 暂停 → 人类确认 → Graph 恢复 → 再执行 |

V7 手写 Agent Loop 是模型自动调用 Tool；V28 LangGraph 在这个 Loop 中加入了「暂停等待人工决策」的能力。

对照手写：

```text
if (dangerousTool) {
  const approved = await askUser();
  if (approved) executeTool();
}
```

LangGraph：`Conditional Edge / Router → interrupt → checkpoint → Command({ resume }) → 继续 Graph`。

`readline` 只是当前 Node.js 进程阻塞等输入。`interrupt` 是工作流把 State 存进 Checkpointer，之后还可以用同一个 `thread_id` 恢复。即使这次 Demo 用命令行输入，也必须走 LangGraph 的暂停 / 恢复，不能拿 readline 假装 Human in the Loop。

### 三个核心概念

| 概念 | 含义 |
| --- | --- |
| **interrupt** | 暂停。Graph 执行到这里停住，把 payload 交给外部 |
| **checkpoint** | 保存暂停时的 State。没有 Checkpointer，暂停后无法恢复 |
| **resume** | 带着人工输入继续执行。`Command({ resume: "yes" / "no" })` 的值会变成 `interrupt()` 的返回值 |

**thread_id 为什么重要：** resume 时必须找到原来那条 Graph 线程的 State，而不是新建一个流程。换一个 `thread_id` 等于从头开始，刚才的转账确认就丢了。

### 为什么生产环境需要它

LLM 可以负责「建议做什么」，但真正有副作用的操作不一定应该由模型完全自动执行。例如：转账、删除数据、发邮件、发布内容、退款、修改权限、执行生产环境操作。

这一版用 `transferMoney` 当高风险 Tool（只模拟，不调银行接口），用 `calculator` 当普通 Tool 对照。

### 流程

```text
START → callModel → routeTools
  calculator     → tools（自动执行）→ callModel → END
  transferMoney  → humanApproval
                   interrupt 暂停
                   人工输入 yes / no
                   Command({ resume }) 恢复
                   yes → executeTransfer → callModel → END
                   no  → rejectTransfer  → callModel → END
```

只拦截 `transferMoney`，不要给所有 Tool 都加确认。

### 测试场景

1. `23 * 47 等于多少？` → calculator 自动执行 → 最终回答
2. `帮我给 account-001 转 100 元。` → interrupt → 输入 `yes` → 模拟转账 → 回答已完成
3. 同样转账请求 → interrupt → 输入 `no` → 不执行 Tool → 回答已取消

### 打断点

1. `callModel` 返回 AIMessage，出现 `transferMoney` tool_call
2. `routeTools` 判断这是高风险 Tool
3. `interrupt()` 前后：这里还没有执行转账
4. 第一次 `graph.invoke` 返回 `__interrupt__`
5. `new Command({ resume })` 恢复 Graph
6. resume 后重新进入 `humanApproval`，看人工输入如何变成 `interrupt()` 的返回值
7. `afterApproval`：yes 走 `executeTransfer`，no 走 `rejectTransfer`

### 这一版明确不做

- 继续扩展 RAG / Multi-Agent
- 第三方银行接口、真实转账
- 复杂权限系统 / 策略引擎
- token streaming / SSE / React
- 数据库 Checkpointer
- V29

---

## V29 · Persistence / Production Checkpoint

一句话：**V24 的 MemorySaver 只适合当前进程里的 Demo。真实 Human in the Loop、长任务、多轮 Agent，通常需要把 Graph State 持久化到外部存储，服务重启后还能按 thread_id 恢复。**

这一版拆成多个可单独运行的 Demo，方便打断点，不要一次执行到底。

| 命令 | 文件 | 只学这一件事 |
| --- | --- | --- |
| `pnpm v29-setup` | `src/v29/00-setup.ts` | 官方 `setup()` 建表 |
| `pnpm v29-memory` | `src/v29/01-memory-checkpoint.ts` | 内存 Checkpointer 对照 |
| `pnpm v29-save` | `src/v29/02-persistent-save.ts` | 写入 PostgreSQL 后进程退出 |
| `pnpm v29-resume` | `src/v29/03-persistent-resume.ts` | 新进程用同一 thread_id 恢复 |
| `pnpm v29-threads` | `src/v29/04-thread-isolation.ts` | 多 thread 隔离 |

建议顺序：`v29-memory`（对照）→ `v29-setup` → `v29-save` → 确认进程已退出 → `v29-resume` → `v29-threads`。

Graph 仍然极简：`START → callModel → END`。没有 Tool Calling、没有 RAG、没有人工审批。

### InMemory vs Persistent

| | InMemory（MemorySaver） | Persistent（PostgresSaver） |
| --- | --- | --- |
| State 存在哪 | 当前 Node 进程内存 | 外部 PostgreSQL |
| 进程关闭后 | 丢失 | 还在 |
| 服务重启 | 无法恢复 | 用相同 thread_id 恢复 |
| 适合 | Demo、测试 | 长会话、Human in the Loop、长任务恢复 |

生产环境还有 Redis 或其他持久化选择，这一版不展开，只选 PostgreSQL。

### Checkpoint 不只是聊天消息库

LangGraph Checkpoint 保存的是 **Graph State 的快照**，不是一张单纯的 Message 表。

当前 Demo 的 State 主要是 `messages`。以后如果 State 里还有 `pendingApproval`、`currentStep`、`retrievedDocs`、`taskStatus`，它们也会作为工作流状态一起保存。

所以它解决的是 **Graph 恢复**，而不只是「把聊天历史存下来」。这也是 V28 的 interrupt 必须配合 Checkpointer 的原因：暂停时要把整份工作流现场存住。

### 业务 DB 和 Checkpointer 不是互相替代

真实生产项目通常仍然会有自己的业务数据库。

| | 负责什么 |
| --- | --- |
| 业务 Conversation / Message 表 | 聊天列表、标题、搜索、审计、运营统计、删除会话、前端消息展示 |
| LangGraph Checkpointer | Graph 执行状态恢复：messages 以及 pendingApproval 等工作流字段 |

手写 V1～V20（`D:\learn\agent\MyProject\`）常见路径：

```text
conversationId → MySQL 查询 Messages → 拼 history → 调模型
```

LangGraph：

```text
thread_id → Checkpointer → 自动恢复 Graph State
```

前端如果要查所有会话列表、改标题、删消息，依然可能需要自己的 Conversation / Message 表。这一版不实现两套数据库同步。

thread_id 不是 userId。真实系统里常见映射是：`userId` 代表用户，`conversationId` 代表一条聊天会话，LangGraph 经常可以把 `conversationId` 映射成 `thread_id`。不要写死必须相等。

### PostgreSQL 准备

1. 本机先有 PostgreSQL，并建一个空数据库，例如 `langgraph_learn`。
2. 在 `.env` 填写（不要写进代码）：

```bash
POSTGRES_URL=postgresql://用户:密码@127.0.0.1:5432/langgraph_learn
```

3. 第一次先跑官方初始化，不要自己设计表结构：

```bash
pnpm v29-setup
```

`PostgresSaver.setup()` 会创建 / 迁移 Checkpointer 所需的表。表已存在时再跑也安全。

### 最重要的实验

```text
pnpm v29-save
  → Graph 执行
  → PostgreSQL Checkpointer 保存 State
  → Node 进程退出

pnpm v29-resume
  → 全新 Node 进程启动
  → 相同 thread_id = v29-demo-thread
  → Checkpointer 读取 State
  → Graph 继续运行
```

不要用 JS 全局变量、JSON 文件或手动复制 messages 假装恢复。必须是两个独立进程 + 数据库 Checkpointer。

`v29-memory` 证明：同一个进程里 MemorySaver 能恢复。把它关掉再重跑，历史就没了。这就是对照组。

### 打断点

不必跟进官方 `checkpointer.put()` 源码。看输入和恢复结果即可。

1. `v29-memory` 第二轮进入 `callModel` 时的 `messages`
2. `v29-save` 第一次 `invoke` 前后的 State
3. `v29-save` 的 `invoke` 返回之后：官方写入已经发生，看 `graph.getState`
4. `v29-resume` 新进程第一次进入 `callModel` 时的 `messages`，确认小明 / Vue 已在
5. `v29-threads` 里 `thread-a` / `thread-b` 分别进入模型时的 `messages`，观察隔离

### 这一版明确不做

- Tool Calling / Agentic RAG / Human Approval
- Redis Checkpointer（只提一句，不实现）
- Streaming / SSE / React / Docker
- 两套数据库同步
- V30

---

## V30 · LangGraph Streaming

一句话：**Model 在流 Token，Graph 在流执行状态，HTTP SSE 只是把这些流传给 Browser。**

这一版拆成多个可单独运行的 Demo。不要一次执行全部。

| 命令 | 文件 | 只学这一件事 |
| --- | --- | --- |
| `pnpm v30-values` | `src/v30/01-stream-values.ts` | 每一步之后的完整 State |
| `pnpm v30-updates` | `src/v30/02-stream-updates.ts` | 这一步改了哪些字段 |
| `pnpm v30-messages` | `src/v30/03-stream-messages.ts` | 真实 LLM token/chunk |
| `pnpm v30-events` | `src/v30/04-stream-events.ts` | Graph / Node / Model 执行事件 |
| `pnpm v30-sse` | `src/v30/05-stream-sse.ts` | 把 Stream 接到 HTTP SSE |

共同 Graph：`START → analyze → generateAnswer → END`。没有 Tool、RAG、Human Approval、PostgreSQL Checkpoint。Node 名不能和 State 字段同名，所以节点叫 `generateAnswer`，字段仍叫 `answer`。

### Streaming 的层次

| 层 | 是什么 | 回答什么问题 |
| --- | --- | --- |
| 1. `invoke` | 等全部跑完 | 最终结果是什么 |
| 2. `values` | 每一步之后的完整 State | State 现在长什么样 |
| 3. `updates` | 每一步的增量 | 这一步修改了什么 |
| 4. `messages` / token | LLM 正在生成的内容 | 模型生成了什么 |
| 5. `events` | Graph / Node / Model 生命周期 | Agent 现在正在干什么 |
| 6. SSE | HTTP 长连接 | 怎么把上面这些传给浏览器 |

**values = 看完整状态，updates = 看这一步修改了什么。**

**Token Streaming 回答「模型生成了什么」。Event Streaming 回答「整个 Agent 现在正在干什么」。** 所以前端才能显示「正在分析 → 正在生成答案」，而不仅仅是文字一个个出来。

这两层不要混：

- Graph Streaming：执行到哪一步、State 怎么变
- Model Streaming：某次 LLM 调用正在吐哪些 chunk

### SSE 不是 LangGraph 的功能

SSE 是 Browser 和 Server 之间的传输协议。LangGraph stream 是 Server 内部 Graph 执行过程的数据来源。

```text
LLM → LangGraph Node → LangGraph Stream → Node Server → SSE → Browser
```

手写对照（`D:\learn\agent\MyProject\`）：

| 手写 | 对应 |
| --- | --- |
| V2 Streaming | LLM Token Streaming |
| V13 SSE | Server → Browser 数据通道 |
| V14 Background Run | 更高级的任务状态和断线恢复（本版不做） |
| V30 | 中间加了 LangGraph，把 Node 等工作流状态也变成可流式事件 |

以前可能只有 token。现在还可以有 node 开始、分析中、生成中、node 结束。SSE 本身没变，变的是数据来源更丰富。

`pnpm v30-sse` 会起一个极简页面：`http://127.0.0.1:3000`  
也可以：`curl -N "http://127.0.0.1:3000/api/chat/stream?question=LangGraph%20是什么"`

事件只有：`status` / `token` / `done` / `error`。不做自动重连、Last-Event-ID、后台 Run。

### 打断点

1. `v30-values` 的 `for await` 每次收到 State
2. `v30-updates` 收到某个 Node update
3. `v30-messages` 收到模型 token chunk
4. `v30-events` 过滤 `event.event` / `event.name`
5. `v30-sse` 里 Graph Stream 转成 `res.write()`
6. 浏览器 EventSource 收到 `token` / `status`

### 这一版明确不做

- Tool Calling / RAG / Human Approval / Checkpoint
- Redis / 数据库 / BullMQ / Background Run
- EventSource 自动重连、Last-Event-ID
- React / 复杂 UI
- V31

---

## V31 · MCP + LangGraph

一句话：**MCP 不负责 Agent 推理，LangGraph 也不负责提供外部业务能力。MCP 负责「能力怎么标准化暴露和连接」，LangGraph 负责「Agent 什么时候、以什么流程使用这些能力」。**

这一版不从零讲 MCP 协议。手写 V10 已经练过 `connect` / `listTools` / `callTool`。V31 做的是映射：把那套协议接到 LangChain / LangGraph 上。

每个 Demo 只完成一个目标。不要一个命令把 Server、Client、Agent、Multi Server 全部跑一遍。

| 命令 | 文件 | 只学这一件事 |
| --- | --- | --- |
| `pnpm v31-server` | `src/v31/01-mcp-server.ts` | 启动 MCP Server，暴露两个 Tool |
| `pnpm v31-client` | `src/v31/02-mcp-client.ts` | MCP Client 发现并直接调用 Tool |
| `pnpm v31-tools` | `src/v31/03-mcp-to-langchain-tools.ts` | Adapter 把 MCP Tool 转成 LangChain Tool |
| `pnpm v31-agent` | `src/v31/04-langgraph-mcp-agent.ts` | LangGraph Agent Loop 调用 MCP Tool |
| `pnpm v31-multi-server` | `src/v31/05-multi-mcp-server.ts` | 一个 Agent 同时用两个 MCP Server |

`v31-client` 不要自动接着跑 `v31-agent`。`v31-agent` 也不要自动跑 multi-server。

stdio MCP Server 由 Client / Adapter 自动拉起子进程，这是正常的。代码仍然把 Server 和 Client 分成不同文件，方便分别阅读和打断点。

`pnpm v31-server` 只启动 Server，不跑 Client。stdio Server 会等 stdin，看到 `MCP Server started` 后用 Ctrl+C 退出。日志走 stderr，因为 stdout 是协议通道。

### 几个角色

| 角色 | 干什么 | 不干什么 |
| --- | --- | --- |
| **MCP Server** | Tool 提供方。对外暴露能力 | 不推理、不跑 Agent Loop |
| **MCP Client** | Tool 使用方与 Server 的连接层 | 不是 LLM |
| **MCP Adapter** | 把 MCP Tool 转成 LangChain 能理解的 Tool | 不决定何时调用 |
| **LangGraph** | 决定什么时候调用这些 Tool，管理 Agent Loop | 不提供外部业务能力 |
| **LLM** | 决定当前问题是否需要某个 Tool | 不知道背后是不是 MCP |

整体链路：

```text
LLM → LangGraph → LangChain Tool → MCP Client → MCP Server → JS Function / API / Database
```

V31 的 calculator 和 getUserInfo 停在「JS Function」。MCP 底下仍然可以去调 REST、数据库、SDK；MCP 本身不是万能 API 替代品。它主要解决的是 **AI 应用与工具 / 上下文之间的标准化连接**。

### 手写 V10 ↔ V31

手写项目：`D:\learn\agent\MyProject\`

| 手写 V10 | V31 |
| --- | --- |
| `@modelcontextprotocol/server` + `registerTool` + `serveStdio` | `@modelcontextprotocol/sdk` 的 `McpServer` + `StdioServerTransport` |
| 自己创建 MCP Client | 官方 `Client` + `StdioClientTransport` |
| `client.connect()` | 仍然是 `client.connect()` |
| `client.listTools()` | 仍然是 `client.listTools()` |
| `client.callTool()` | 仍然是 `client.callTool()` |
| 自己把 MCP schema 转成 OpenAI `tools`（`toLlmTools`） | `@langchain/mcp-adapters` 的 `getTools()` / `loadMcpTools()` |
| Agent 自己写 Tool Router，按名字分流 local / MCP | LangGraph `bindTools` + `ToolNode`，MCP Tool 看起来就是普通 Tool |

协议层还在。Adapter 只是帮你把 MCP Tool 转成 LangChain Tool，可以直接塞进 Agent，不必再手写一套 Tool Router。

### 本地 Tool 和 MCP Tool

| | 本地 Tool（V23） | MCP Tool（V31） |
| --- | --- | --- |
| 能力写在哪 | 通常和 Agent 同一个项目 / 进程 | 独立 MCP Server 进程 |
| 怎么接到 Agent | `tool()` 之后 `bindTools` / `ToolNode` | Adapter 转成 LangChain Tool 之后，同样 `bindTools` / `ToolNode` |
| 模型看到什么 | name + description + schema | 一样 |
| 模型知不知道 MCP | 不知道 | 也不知道 |

所以模型本身其实不知道这个 Tool 背后是不是 MCP。对它来说都是：有一个名字、一段说明、一份参数 schema、可以被调用。

MCP 的价值：Agent 不必为 GitHub、数据库、文件系统、内部平台分别写一套特殊接入协议。只要能力方提供 MCP Server，Agent 就可以通过统一 MCP Client 接入。

但不要把 MCP 说成「万能 API 替代品」。底层业务能力依然可能调用 REST API、数据库、SDK。MCP 标准化的是 **AI 应用怎么发现和调用这些能力**，不是把所有后端接口都替换掉。

### 五个 Demo 分别在干什么

**1. `v31-server`**

最简单的 MCP Server，两个 Tool：

- `calculator`：输入 `a` / `b` / `operation`（add / subtract / multiply / divide）
- `getUserInfo`：输入 `userId`，返回模拟数据 `{ name: "Tom", role: "frontend engineer" }`

不接真实用户库，不接 MySQL。只用本地 stdio，避免 HTTP、鉴权、网络干扰。

**2. `v31-client`**

不使用 LangGraph。Client 启动子进程连接 Server，然后 `listTools()` 打印 `calculator`、`getUserInfo`，再手动 `callTool` 一次 `23 * 47`。

重点：MCP Client 不是 LLM，它只是连接、发现、调用。

**3. `v31-tools`**

用官方 `@langchain/mcp-adapters` 的 `MultiServerMCPClient.getTools()`，不要手工再包一遍 schema。打印转换后的 `name` / `description`（不要打印完整 Tool 对象和 Zod 内部结构），然后 `calculator.invoke({ a: 23, b: 47, operation: "multiply" })`。

这一步仍然不让模型调用 Tool。对比上一课：`callTool()` 是 MCP 层；`invoke()` 是适配成 LangChain Tool 之后。

**4. `v31-agent`**

这是 V31 最重要的部分。复用 V23 Agent Loop，但 Tools 来自 MCP Server：

1. 启动时通过 Adapter 获取 MCP Tools
2. `model.bindTools(mcpTools)`
3. 同样的 Tools 交给 `ToolNode`

测试：

- `23 * 47 等于多少？` → 模型应调用 MCP 的 `calculator`
- `查询用户 user-001 的信息。` → 模型应调用 MCP 的 `getUserInfo`

控制台只打印：User、Model 请求哪个 MCP Tool、Tool Result、Final Answer。协议细节回 V10 手写版打断点。

**5. `v31-multi-server`**

两个 Server 即可：Calculator Server 和 User Server。`MultiServerMCPClient` 把两边的 Tool 合成一份。测试问题会让模型分别调用 user MCP 和 calculator MCP。

不做：动态注册中心、MCP Gateway、服务发现、负载均衡、复杂权限。

### 打断点

不必跟进 JSON-RPC 原始包。V31 重心是框架整合。

1. `01-mcp-server.ts`：MCP Server 收到 `calculator` 调用请求
2. `02-mcp-client.ts`：`listTools()` 返回的位置
3. `03-mcp-to-langchain-tools.ts`：Adapter 转成 LangChain Tools 之后
4. `04-langgraph-mcp-agent.ts`：`callModel` 返回 `AIMessage.tool_calls`
5. `04-langgraph-mcp-agent.ts`：`ToolNode` 准备执行 MCP Tool
6. `01-mcp-server.ts`：Server 执行 Tool 并返回结果
7. `04-langgraph-mcp-agent.ts`：第二次 `callModel` 时 messages 里已有 `ToolMessage`

### 这一版明确不做

- MCP Resource / Prompt / Sampling
- 远程 HTTP MCP、OAuth、复杂鉴权
- RAG、Checkpoint、Human in the Loop、Streaming
- Server 动态注册、Gateway、服务发现、负载均衡
- V32

做完 V31，应该能看到一个 MCP Server，并知道怎么把它接进 LangChain / LangGraph，而不是重新为它手写一套 Tool Router。
