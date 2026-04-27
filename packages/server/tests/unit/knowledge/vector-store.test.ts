import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../../src/db/index.js";
import { VectorStore, type ChunkWithEmbedding } from "../../../src/services/knowledge/vector-store.js";
import type Database from "better-sqlite3";

function makeChunk(
  content: string,
  embedding: number[],
  sourceIndex = 0,
  chunkIndex = 0,
): ChunkWithEmbedding {
  return {
    content,
    metadata: { sourceIndex, sourceType: "text", chunkIndex, title: "Test" },
    embedding: new Float32Array(embedding),
  };
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

describe("VectorStore", () => {
  let db: Database.Database;
  let store: VectorStore;

  beforeEach(() => {
    db = createTestDb();
    store = new VectorStore(db);
  });

  it("stores and retrieves chunks", () => {
    const chunks = [
      makeChunk("Hello world", normalize([1, 0, 0])),
      makeChunk("Goodbye world", normalize([0, 1, 0])),
    ];

    store.upsertChunks("site1", chunks, "test-model");

    expect(store.hasEmbeddings("site1")).toBe(true);
    expect(store.chunkCount("site1")).toBe(2);
  });

  it("returns false for hasEmbeddings when no chunks exist", () => {
    expect(store.hasEmbeddings("empty")).toBe(false);
  });

  it("searches by cosine similarity", () => {
    const v1 = normalize([1, 0, 0]);
    const v2 = normalize([0, 1, 0]);
    const v3 = normalize([0.9, 0.1, 0]);

    store.upsertChunks(
      "site1",
      [
        makeChunk("About cats", v1, 0, 0),
        makeChunk("About dogs", v2, 1, 0),
        makeChunk("Also about cats", v3, 2, 0),
      ],
      "test-model",
    );

    const query = new Float32Array(normalize([1, 0, 0]));
    const results = store.search("site1", query, 2, 0.5);

    expect(results).toHaveLength(2);
    expect(results[0].content).toBe("About cats");
    expect(results[0].score).toBeCloseTo(1.0, 2);
    expect(results[1].content).toBe("Also about cats");
  });

  it("respects similarity threshold", () => {
    store.upsertChunks(
      "site1",
      [
        makeChunk("Match", normalize([1, 0, 0])),
        makeChunk("No match", normalize([0, 1, 0])),
      ],
      "test-model",
    );

    const query = new Float32Array(normalize([1, 0, 0]));
    const results = store.search("site1", query, 10, 0.9);

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Match");
  });

  it("respects topK limit", () => {
    const chunks = Array.from({ length: 10 }, (_, i) =>
      makeChunk(`Chunk ${i}`, normalize([1, 0.01 * i, 0]), i, 0),
    );

    store.upsertChunks("site1", chunks, "test-model");

    const query = new Float32Array(normalize([1, 0, 0]));
    const results = store.search("site1", query, 3, 0);

    expect(results).toHaveLength(3);
  });

  it("upsert replaces existing chunks for the site", () => {
    store.upsertChunks("site1", [makeChunk("Old", normalize([1, 0, 0]))], "v1");
    expect(store.chunkCount("site1")).toBe(1);

    store.upsertChunks("site1", [makeChunk("New1", normalize([1, 0, 0])), makeChunk("New2", normalize([0, 1, 0]))], "v2");
    expect(store.chunkCount("site1")).toBe(2);
  });

  it("isolates chunks between sites", () => {
    store.upsertChunks("site1", [makeChunk("Site 1", normalize([1, 0, 0]))], "v1");
    store.upsertChunks("site2", [makeChunk("Site 2", normalize([1, 0, 0]))], "v1");

    const query = new Float32Array(normalize([1, 0, 0]));
    const results = store.search("site1", query, 10, 0);

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Site 1");
  });

  it("deleteChunksForSite removes all chunks", () => {
    store.upsertChunks("site1", [makeChunk("Data", normalize([1, 0, 0]))], "v1");
    expect(store.hasEmbeddings("site1")).toBe(true);

    store.deleteChunksForSite("site1");
    expect(store.hasEmbeddings("site1")).toBe(false);
  });
});
