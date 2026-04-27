import type { KnowledgeSource } from "@kody/shared";
import { UrlFetcher } from "./url-fetcher.js";
import { readKnowledgeFile } from "./file-reader.js";

/** Knowledge source enriched with fetched content for url/file types. */
export type EnrichedKnowledgeSource = KnowledgeSource & {
  fetchedContent?: string;
};

export interface KnowledgeAssembler {
  assemble(sources: KnowledgeSource[], maxTokens: number): Promise<EnrichedKnowledgeSource[]>;
}

const CHARS_PER_TOKEN = 4;

function estimateChars(source: EnrichedKnowledgeSource): number {
  switch (source.type) {
    case "text":
      return source.title.length + source.content.length;
    case "faq":
      return source.entries.reduce((sum: number, e: { question: string; answer: string }) => sum + e.question.length + e.answer.length, 0);
    case "url":
      return (source.fetchedContent?.length ?? 0) + (source.title?.length ?? source.url.length);
    case "file":
      return (
        (source.fetchedContent?.length ?? 0) + (source.title?.length ?? source.filePath.length)
      );
    default:
      return 0;
  }
}

export function createKnowledgeAssembler(
  urlFetcher: UrlFetcher = new UrlFetcher(),
  fileBaseDir?: string,
): KnowledgeAssembler {
  return {
    async assemble(
      sources: KnowledgeSource[],
      maxTokens: number,
    ): Promise<EnrichedKnowledgeSource[]> {
      const maxChars = maxTokens * CHARS_PER_TOKEN;
      const enriched: EnrichedKnowledgeSource[] = [];

      for (const source of sources) {
        let entry: EnrichedKnowledgeSource;

        switch (source.type) {
          case "text":
          case "faq":
            entry = { ...source };
            break;
          case "url": {
            const fetchedContent = await urlFetcher.fetch(
              source.url,
              source.refreshIntervalHours,
              source.enableJsRendering,
            );
            entry = { ...source, fetchedContent: fetchedContent ?? undefined };
            break;
          }
          case "file": {
            const fetchedContent = readKnowledgeFile(source.filePath, fileBaseDir);
            entry = { ...source, fetchedContent: fetchedContent ?? undefined };
            break;
          }
        }

        enriched.push(entry);
      }

      // Apply token budget: truncate total content to fit maxChars
      let totalChars = 0;
      const result: EnrichedKnowledgeSource[] = [];

      for (const source of enriched) {
        const chars = estimateChars(source);
        if (totalChars + chars <= maxChars) {
          result.push(source);
          totalChars += chars;
        } else {
          // Truncate the last source's content to fit remaining budget
          const remaining = maxChars - totalChars;
          if (remaining <= 0) break;

          if ((source.type === "url" || source.type === "file") && source.fetchedContent) {
            result.push({
              ...source,
              fetchedContent: source.fetchedContent.slice(0, remaining),
            });
          } else if (source.type === "text") {
            result.push({
              ...source,
              content: source.content.slice(0, remaining),
            });
          }
          // FAQ and sources without content are dropped if they don't fit
          break;
        }
      }

      return result;
    },
  };
}
