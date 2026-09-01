import { AIMessage, type BaseMessage } from "@langchain/core/messages";

export function textFromModel(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

export function lastModelAnswer(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.getType() !== "ai") {
      continue;
    }

    const aiMessage = message as AIMessage;
    if ((aiMessage.tool_calls?.length ?? 0) > 0) {
      continue;
    }

    return textFromModel(aiMessage.content).trim();
  }

  return "";
}

export function usedToolNames(messages: BaseMessage[]): string[] {
  const names: string[] = [];

  for (const message of messages) {
    if (message.getType() === "ai") {
      for (const call of (message as AIMessage).tool_calls ?? []) {
        names.push(call.name);
      }
    }
  }

  return [...new Set(names)];
}

export function usedToolNamesThisTurn(messages: BaseMessage[]): string[] {
  let lastHuman = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].getType() === "human") {
      lastHuman = index;
      break;
    }
  }

  return usedToolNames(messages.slice(lastHuman));
}
