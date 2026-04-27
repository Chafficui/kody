import { describe, it, expect } from "vitest";
import { chunkKnowledgeSources, type ChunkOptions } from "../../../src/services/knowledge/chunker.js";
import type { EnrichedKnowledgeSource } from "../../../src/services/knowledge/index.js";

const defaultOptions: ChunkOptions = { chunkSize: 500, chunkOverlap: 50 };

describe("chunkKnowledgeSources", () => {
  it("chunks text source into paragraphs", () => {
    const sources: EnrichedKnowledgeSource[] = [
      { type: "text", title: "Doc", content: "Para one.\n\nPara two.\n\nPara three." },
    ];

    const chunks = chunkKnowledgeSources(sources, defaultOptions);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("Para one");
    expect(chunks[0].content).toContain("Para three");
    expect(chunks[0].metadata).toEqual({
      sourceIndex: 0,
      sourceType: "text",
      chunkIndex: 0,
      title: "Doc",
    });
  });

  it("splits large text into multiple chunks", () => {
    const sentences = Array.from({ length: 50 }, (_, i) => `This is sentence number ${i + 1}.`);
    const sources: EnrichedKnowledgeSource[] = [
      { type: "text", title: "Long", content: sentences.join(" ") },
    ];

    const chunks = chunkKnowledgeSources(sources, { chunkSize: 100, chunkOverlap: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.metadata.sourceType).toBe("text");
      expect(chunk.metadata.title).toBe("Long");
    }
  });

  it("creates one chunk per FAQ entry", () => {
    const sources: EnrichedKnowledgeSource[] = [
      {
        type: "faq",
        entries: [
          { question: "What is Kody?", answer: "A chat widget." },
          { question: "How to install?", answer: "Use npm." },
        ],
      },
    ];

    const chunks = chunkKnowledgeSources(sources, defaultOptions);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe("Q: What is Kody?\nA: A chat widget.");
    expect(chunks[0].metadata.question).toBe("What is Kody?");
    expect(chunks[1].content).toBe("Q: How to install?\nA: Use npm.");
  });

  it("chunks URL source fetched content", () => {
    const sources: EnrichedKnowledgeSource[] = [
      {
        type: "url",
        url: "https://example.com",
        refreshIntervalHours: 24,
        enableJsRendering: true,
        fetchedContent: "Fetched content from the web.",
      },
    ];

    const chunks = chunkKnowledgeSources(sources, defaultOptions);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Fetched content from the web.");
    expect(chunks[0].metadata.url).toBe("https://example.com");
  });

  it("skips URL sources with no fetched content", () => {
    const sources: EnrichedKnowledgeSource[] = [
      {
        type: "url",
        url: "https://example.com",
        refreshIntervalHours: 24,
        enableJsRendering: true,
      },
    ];

    const chunks = chunkKnowledgeSources(sources, defaultOptions);

    expect(chunks).toHaveLength(0);
  });

  it("chunks file source fetched content", () => {
    const sources: EnrichedKnowledgeSource[] = [
      {
        type: "file",
        filePath: "docs/guide.txt",
        fetchedContent: "File content here.",
      },
    ];

    const chunks = chunkKnowledgeSources(sources, defaultOptions);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("File content here.");
    expect(chunks[0].metadata.title).toBe("docs/guide.txt");
  });

  it("handles multiple sources with correct source indices", () => {
    const sources: EnrichedKnowledgeSource[] = [
      { type: "text", title: "First", content: "Text one." },
      {
        type: "faq",
        entries: [{ question: "Q?", answer: "A." }],
      },
      {
        type: "url",
        url: "https://test.com",
        refreshIntervalHours: 1,
        enableJsRendering: false,
        fetchedContent: "Web content.",
      },
    ];

    const chunks = chunkKnowledgeSources(sources, defaultOptions);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].metadata.sourceIndex).toBe(0);
    expect(chunks[1].metadata.sourceIndex).toBe(1);
    expect(chunks[2].metadata.sourceIndex).toBe(2);
  });

  it("applies overlap between chunks", () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `Sentence number ${i + 1}.`);
    const text = sentences.join(" ");
    const sources: EnrichedKnowledgeSource[] = [
      { type: "text", title: "Overlap", content: text },
    ];

    const chunks = chunkKnowledgeSources(sources, { chunkSize: 100, chunkOverlap: 30 });

    if (chunks.length >= 2) {
      const end1 = chunks[0].content.slice(-30);
      expect(chunks[1].content).toContain(end1.trim().split(" ").pop()!);
    }
  });
});
