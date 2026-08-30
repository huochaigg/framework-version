import type { Document } from "@langchain/core/documents";

export function documentId(document: Document): string {
  const id = document.metadata?.id;
  return typeof id === "string" && id.length > 0 ? id : document.pageContent;
}

export function documentTitle(document: Document): string {
  const title = document.metadata?.title;
  if (typeof title === "string" && title.length > 0) {
    return title;
  }

  return document.pageContent.replace(/\s+/g, " ").slice(0, 32);
}

export function documentPreview(document: Document): string {
  const snippet = document.pageContent.replace(/\s+/g, " ").slice(0, 40);
  return `${documentTitle(document)}：${snippet}`;
}
