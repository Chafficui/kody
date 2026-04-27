import type Database from "better-sqlite3";
import type { SiteConfig } from "@kody/shared";
import type { KnowledgeAssembler } from "./index.js";
import type { EmbeddingService } from "./embedding.js";
import { VectorStore } from "./vector-store.js";
import { chunkKnowledgeSources } from "./chunker.js";

export interface IndexResult {
  chunkCount: number;
  status: "success" | "error";
  error?: string;
}

export class KnowledgeIndexer {
  private vectorStore: VectorStore;

  constructor(
    private db: Database.Database,
    private knowledgeAssembler: KnowledgeAssembler,
    private embeddingService: EmbeddingService,
  ) {
    this.vectorStore = new VectorStore(db);
  }

  async index(config: SiteConfig): Promise<IndexResult> {
    const jobId = this.createJob(config.siteId);

    try {
      this.updateJobStatus(jobId, "running");

      const enriched = await this.knowledgeAssembler.assemble(
        config.knowledge.sources,
        config.knowledge.maxContextTokens,
      );

      const chunks = chunkKnowledgeSources(enriched, {
        chunkSize: config.knowledge.rag.chunkSize,
        chunkOverlap: config.knowledge.rag.chunkOverlap,
      });

      if (chunks.length === 0) {
        this.vectorStore.deleteChunksForSite(config.siteId);
        this.completeJob(jobId, 0);
        return { chunkCount: 0, status: "success" };
      }

      const texts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingService.embed(texts);

      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));

      const model = `dim-${this.embeddingService.dimensions()}`;
      this.vectorStore.upsertChunks(config.siteId, chunksWithEmbeddings, model);

      this.completeJob(jobId, chunks.length);
      return { chunkCount: chunks.length, status: "success" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.failJob(jobId, message);
      return { chunkCount: 0, status: "error", error: message };
    }
  }

  getLastJob(siteId: string): { status: string; chunkCount: number; completedAt: string | null } | null {
    const row = this.db
      .prepare(
        "SELECT status, chunk_count, completed_at FROM embedding_jobs WHERE site_id = ? ORDER BY id DESC LIMIT 1",
      )
      .get(siteId) as { status: string; chunk_count: number; completed_at: string | null } | undefined;

    return row
      ? { status: row.status, chunkCount: row.chunk_count, completedAt: row.completed_at }
      : null;
  }

  private createJob(siteId: string): number {
    const result = this.db
      .prepare("INSERT INTO embedding_jobs (site_id, status, started_at) VALUES (?, 'pending', datetime('now'))")
      .run(siteId);
    return Number(result.lastInsertRowid);
  }

  private updateJobStatus(jobId: number, status: string): void {
    this.db
      .prepare("UPDATE embedding_jobs SET status = ?, started_at = datetime('now') WHERE id = ?")
      .run(status, jobId);
  }

  private completeJob(jobId: number, chunkCount: number): void {
    this.db
      .prepare(
        "UPDATE embedding_jobs SET status = 'success', chunk_count = ?, completed_at = datetime('now') WHERE id = ?",
      )
      .run(chunkCount, jobId);
  }

  private failJob(jobId: number, error: string): void {
    this.db
      .prepare(
        "UPDATE embedding_jobs SET status = 'error', error_message = ?, completed_at = datetime('now') WHERE id = ?",
      )
      .run(error, jobId);
  }
}
