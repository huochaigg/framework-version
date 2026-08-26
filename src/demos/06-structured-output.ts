import { z } from "zod";
import { createChatModel, printError } from "../config/llm";

/**
 * Demo 6：Structured Output
 *
 * 手写 V5：
 *   1. Prompt 里规定 JSON 字段
 *   2. response_format: json_object
 *   3. JSON.parse(content)
 *   4. isKnowledgeAnalysis() 手写 runtime validation
 *
 * LangChain 当前推荐：
 *   1. 用 Zod 定义 Schema
 *   2. model.withStructuredOutput(schema)
 *   3. invoke() 直接得到类型化对象
 *
 * withStructuredOutput 不是 JSON.parse 的马甲。
 * 它会尽量走模型的 Structured Output / Tool Calling 能力，
 * 再在运行时用 Schema 校验。这正是 V5 想做、但要自己拼的那一层。
 */

const productAnalysisSchema = z.object({
  productName: z.string().describe("商品名称"),
  sellingPoints: z.array(z.string()).describe("卖点，列出 2～4 条"),
  targetUsers: z.array(z.string()).describe("目标用户"),
  riskLevel: z.enum(["low", "medium", "high"]).describe("风险等级")
});

// z.infer 从 Zod Schema 推导 TypeScript 类型，不用再手写一份 interface。
type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

async function main() {
  try {
    const model = createChatModel();

    // 打断点建议：Step Into withStructuredOutput，看 Schema 如何变成一次模型调用
    //
    // ChatOpenAI 对非 gpt-3 / gpt-4 的模型名，会默认 method: "jsonSchema"
    // （response_format: json_schema）。DeepSeek / 百炼多数返回：
    //   400 This response_format type is unavailable now
    //
    // functionCalling 走 Tool Calling 通道：模型提出一次「假工具」，
    // LangChain 把参数校验成对象。这仍然不是 Agent Loop，只是借工具协议拿结构化结果。
    const structuredModel = model.withStructuredOutput(productAnalysisSchema, {
      name: "ProductAnalysis",
      method: "functionCalling"
    });

    const productDescription = `
一款面向初学者的机械键盘。轴体声音偏轻，键帽是 PBT。
宣传续航 40 小时，但充电口是 USB-C，说明书没有写是否支持热插拔。
价格比同配置竞品高 20%。适合办公打字，不太适合重度游戏。
`;

    console.log("========== Zod Schema ==========\n");
    console.log("字段：productName / sellingPoints / targetUsers / riskLevel");
    console.log("riskLevel 只能是 low | medium | high\n");

    console.log("========== 商品描述 ==========\n");
    console.log(productDescription.trim());
    console.log("");

    console.log("========== withStructuredOutput() ==========\n");

    const result: ProductAnalysis = await structuredModel.invoke(
      `根据下面的商品描述，返回结构化分析。用中文填写。\n${productDescription}`
    );

    console.log("返回值已经是对象，不是 JSON 字符串：");
    console.log(result);
    console.log("");
    console.log("TypeScript 能补全 result.productName，因为类型是从 Zod Schema infer 出来的。");
    console.log("如果模型给了非法 riskLevel，Zod 会在运行时校验失败。");
    console.log("");
    console.log("对照：");
    console.log("- V5 手写：模型返回 JSON → JSON.parse → 自己写 validate");
    console.log("- V21：定义 Zod Schema → withStructuredOutput → 得到类型化对象");
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}

await main();
