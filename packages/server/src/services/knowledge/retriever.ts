import type Database from "better-sqlite3";
import type { EmbeddingService } from "./embedding.js";
import { VectorStore, type SearchResult } from "./vector-store.js";

export interface RagConfig {
  topK: number;
  similarityThreshold: number;
}

export class KnowledgeRetriever {
  private vectorStore: VectorStore;

  constructor(
    db: Database.Database,
    private embeddingService: EmbeddingService,
  ) {
    this.vectorStore = new VectorStore(db);
  }

  async retrieve(siteId: string, query: string, config: RagConfig): Promise<SearchResult[]> {
    const [queryEmbedding] = await this.embeddingService.embed([query]);
    return this.vectorStore.search(siteId, queryEmbedding, config.topK, config.similarityThreshold);
  }

  hasIndex(siteId: string): boolean {
    return this.vectorStore.hasEmbeddings(siteId);
  }

  formatAsContext(results: SearchResult[]): string {
    if (results.length === 0) return "";

    const sections = results.map((r, i) => {
      const label = r.metadata.title ?? r.metadata.url ?? `Source ${r.metadata.sourceIndex + 1}`;
      return `[${i + 1}] ${label} (relevance: ${(r.score * 100).toFixed(0)}%)\n${r.content}`;
    });

    return `Relevant information:\n\n${sections.join("\n\n")}`;
  }
}
