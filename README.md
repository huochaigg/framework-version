# V21 · LangChain Fundamentals 学习笔记

这不是产品文档。这是从「手写 Agent」跨进「框架」的第一课。

对应手写项目：`/Users/dukun/code/learn/agent_learn`（V1～V20）

本仓库是全新独立项目。**不要改原来的手写代码。**

当前做到 **V23**。V21 学 LangChain 组件，V22 学最小 Graph，V23 学 Agent Loop。没有 Memory、RAG、MCP、Streaming、数据库、前端。

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
cd /Users/dukun/code/learn/framework-version
pnpm install
cp .env.example .env
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

如果你已经跑过手写项目 `agent_learn`，可以把那边的 `DEEPSEEK_API_KEY` 填到 `LLM_API_KEY`，`LLM_BASE_URL` 用 `https://api.deepseek.com`，`LLM_MODEL` 用 `deepseek-chat`。

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
  tools/calculator.ts
  tools/current-time.ts
  index.ts                   打印学习顺序
```

每个 Demo 都可以单独运行。出问题会 `try/catch` 并打印原因。

---

## 本版本明确不做

- Memory / Checkpoint
- RAG / MCP
- Streaming
- Redis / MySQL / PostgreSQL / BullMQ
- React UI

V23 把 Agent Loop 跑明白即可。持久化、检索、流式放到后面。

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
