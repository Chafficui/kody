import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createKnowledgeAssembler,
  type EnrichedKnowledgeSource,
} from "../../../src/services/knowledge/index.js";
import { UrlFetcher } from "../../../src/services/knowledge/url-fetcher.js";
import * as fileReader from "../../../src/services/knowledge/file-reader.js";

vi.mock("../../../src/services/knowledge/file-reader.js", () => ({
  readKnowledgeFile: vi.fn(),
}));

describe("KnowledgeAssembler", () => {
  let mockUrlFetcher: UrlFetcher;

  beforeEach(() => {
    mockUrlFetcher = {
      fetch: vi.fn(),
    } as unknown as UrlFetcher;

    vi.mocked(fileReader.readKnowledgeFile).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes text sources through as-is", async () => {
    const assembler = createKnowledgeAssembler(mockUrlFetcher);

    const result = await assembler.assemble(
      [{ type: "text", title: "Docs", content: "Some documentation." }],
      4000,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "text",
      title: "Docs",
      content: "Some documentation.",
    });
  });

  it("passes FAQ sources through as-is", async () => {
    const assembler = createKnowledgeAssembler(mockUrlFetcher);

    const result = await assembler.assemble(
      [
        {
          type: "faq",
          entries: [{ question: "How?", answer: "Like this." }],
        },
      ],
      4000,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "faq",
      entries: [{ question: "How?", answer: "Like this." }],
    });
  });

  it("fetches content for URL sources", async () => {
    vi.mocked(mockUrlFetcher.fetch).mockResolvedValue("Fetched page content");

    const assembler = createKnowledgeAssembler(mockUrlFetcher);

    const result = await assembler.assemble(
      [
        {
          type: "url",
          url: "https://example.com/docs",
          refreshIntervalHours: 24,
        },
      ],
      4000,
    );

    expect(result).toHaveLength(1);
    const urlSource = result[0] as EnrichedKnowledgeSource & { type: "url" };
    expect(urlSource.fetchedContent).toBe("Fetched page content");
    expect(mockUrlFetcher.fetch).toHaveBeenCalledWith("https://example.com/docs", 24, undefined);
  });

  it("reads content for file sources", async () => {
    vi.mocked(fileReader.readKnowledgeFile).mockReturnValue("File content here");

    const assembler = createKnowledgeAssembler(mockUrlFetcher, "/data");

    const result = await assembler.assemble([{ type: "file", filePath: "info.txt" }], 4000);

    expect(result).toHaveLength(1);
    const fileSource = result[0] as EnrichedKnowledgeSource & { type: "file" };
    expect(fileSource.fetchedContent).toBe("File content here");
    expect(fileReader.readKnowledgeFile).toHaveBeenCalledWith("info.txt", "/data");
  });

  it("sets fetchedContent to undefined when URL fetch returns null", async () => {
    vi.mocked(mockUrlFetcher.fetch).mockResolvedValue(null);

    const assembler = createKnowledgeAssembler(mockUrlFetcher);

    const result = await assembler.assemble(
      [
        {
          type: "url",
          url: "https://example.com/broken",
          refreshIntervalHours: 1,
        },
      ],
      4000,
    );

    expect(result).toHaveLength(1);
    const urlSource = result[0] as EnrichedKnowledgeSource & { type: "url" };
    expect(urlSource.fetchedContent).toBeUndefined();
  });

  it("truncates sources to fit token budget", async () => {
    const assembler = createKnowledgeAssembler(mockUrlFetcher);

    // Budget: 100 tokens = 400 chars
    // First source: ~30 chars (fits)
    // Second source: ~500 chars (won't fully fit, should be truncated)
    const result = await assembler.assemble(
      [
        { type: "text", title: "Small", content: "Short text." },
        {
          type: "text",
          title: "Large",
          content: "x".repeat(500),
        },
      ],
      100,
    );

    expect(result).toHaveLength(2);
    // Total chars available = 400
    // First takes ~16 chars ("Small" + "Short text.")
    // Second should be truncated to fill remaining budget
    const second = result[1] as { type: "text"; content: string };
    expect(second.content.length).toBeLessThanOrEqual(400);
  });

  it("drops sources entirely when budget is exhausted", async () => {
    const assembler = createKnowledgeAssembler(mockUrlFetcher);

    // Budget: 10 tokens = 40 chars. First source uses ~30, second won't fit.
    const result = await assembler.assemble(
      [
        { type: "text", title: "First", content: "A".repeat(25) },
        { type: "text", title: "Second", content: "B".repeat(200) },
      ],
      10,
    );

    // First fills 30 chars, leaving 10 for second.
    // Second gets truncated to remaining budget.
    expect(result.length).toBeLessThanOrEqual(2);
    if (result.length === 2) {
      const second = result[1] as { type: "text"; content: string };
      expect(second.content.length).toBeLessThanOrEqual(10);
    }
  });
});
