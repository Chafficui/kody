import type Database from "better-sqlite3";
import type { Chunk } from "./chunker.js";

export interface ChunkWithEmbedding extends Chunk {
  embedding: Float32Array;
}

export interface SearchResult {
  content: string;
  metadata: Chunk["metadata"];
  score: number;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class VectorStore {
  constructor(private db: Database.Database) {}

  upsertChunks(siteId: string, chunks: ChunkWithEmbedding[], embeddingModel: string): void {
    this.deleteChunksForSite(siteId);

    const stmt = this.db.prepare(
      `INSERT INTO knowledge_chunks (site_id, source_index, chunk_index, content, metadata, embedding, embedding_model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertAll = this.db.transaction(() => {
      for (const chunk of chunks) {
        const embeddingBlob = Buffer.from(chunk.embedding.buffer);
        stmt.run(
          siteId,
          chunk.metadata.sourceIndex,
          chunk.metadata.chunkIndex,
          chunk.content,
          JSON.stringify(chunk.metadata),
          embeddingBlob,
          embeddingModel,
        );
      }
    });

    insertAll();
  }

  deleteChunksForSite(siteId: string): void {
    this.db.prepare("DELETE FROM knowledge_chunks WHERE site_id = ?").run(siteId);
  }

  search(siteId: string, queryEmbedding: Float32Array, topK: number, threshold: number): SearchResult[] {
    const rows = this.db
      .prepare("SELECT content, metadata, embedding FROM knowledge_chunks WHERE site_id = ?")
      .all(siteId) as Array<{
      content: string;
      metadata: string;
      embedding: Buffer;
    }>;

    const scored: SearchResult[] = [];

    for (const row of rows) {
      const embedding = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4,
      );
      const score = cosineSimilarity(queryEmbedding, embedding);

      if (score >= threshold) {
        scored.push({
          content: row.content,
          metadata: JSON.parse(row.metadata),
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  hasEmbeddings(siteId: string): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM knowledge_chunks WHERE site_id = ?")
      .get(siteId) as { count: number };
    return row.count > 0;
  }

  chunkCount(siteId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM knowledge_chunks WHERE site_id = ?")
      .get(siteId) as { count: number };
    return row.count;
  }
}
