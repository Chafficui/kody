import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readKnowledgeFile } from "../../../src/services/knowledge/file-reader.js";

describe("readKnowledgeFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "kody-knowledge-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads an existing file", () => {
    writeFileSync(join(tempDir, "docs.txt"), "Product documentation here.");

    const result = readKnowledgeFile("docs.txt", tempDir);

    expect(result).toBe("Product documentation here.");
  });

  it("returns null for non-existent file", () => {
    const result = readKnowledgeFile("missing.txt", tempDir);

    expect(result).toBeNull();
  });

  it("rejects paths containing ..", () => {
    writeFileSync(join(tempDir, "secret.txt"), "top secret");

    const result = readKnowledgeFile("../secret.txt", tempDir);

    expect(result).toBeNull();
  });

  it("rejects paths with .. in the middle", () => {
    const result = readKnowledgeFile("subdir/../../etc/passwd", tempDir);

    expect(result).toBeNull();
  });

  it("truncates content to 50,000 characters", () => {
    writeFileSync(join(tempDir, "big.txt"), "y".repeat(60_000));

    const result = readKnowledgeFile("big.txt", tempDir);

    expect(result).toHaveLength(50_000);
  });
});
