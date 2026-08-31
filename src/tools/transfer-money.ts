import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 高风险 Tool 学习 Demo。只模拟转账，不调用银行接口，不发送真实请求。
 */
export const transferMoney = tool(
  ({ toAccount, amount, remark }) => {
    const note = remark ? `，备注：${remark}` : "";
    return `已模拟转账 ${amount} 元到 ${toAccount}${note}`;
  },
  {
    name: "transferMoney",
    description:
      "向指定账户转账。用户要求转账、汇款、打钱时必须调用。不要自己假装已经转账成功。",
    schema: z.object({
      toAccount: z.string().describe("收款账户，例如 account-001"),
      amount: z.coerce.number().describe("转账金额，单位元"),
      remark: z.string().optional().describe("转账备注")
    })
  }
);
