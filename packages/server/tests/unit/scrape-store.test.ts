import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../../src/db/index.js";
import { ScrapeStore } from "../../src/services/scrape-store.js";
import { SiteStore } from "../../src/services/site-store.js";
import { UrlFetcher } from "../../src/services/knowledge/url-fetcher.js";
import type Database from "better-sqlite3";

function makeSiteConfig(siteId: string, urls: string[]) {
  return {
    siteId,
    enabled: true,
    allowedOrigins: ["https://example.com"],
    ai: {
      baseUrl: "https://api.example.com",
      apiKey: "key",
      model: "gpt-4",
    },
    branding: { name: "Test Bot" },
    guardrails: {
      allowedTopics: ["general"],
      topicDescription: "test",
    },
    knowledge: {
      sources: urls.map((url) => ({
        type: "url" as const,
        url,
        refreshIntervalHours: 24,
      })),
    },
  };
}

describe("ScrapeStore", () => {
  let db: Database.Database;
  let siteStore: SiteStore;
  let urlFetcher: UrlFetcher;
  let scrapeStore: ScrapeStore;

  beforeEach(() => {
    db = createTestDb();
    siteStore = new SiteStore(db);
    urlFetcher = { fetch: vi.fn(), invalidate: vi.fn(), getLastScrape: vi.fn() } as unknown as UrlFetcher;
    scrapeStore = new ScrapeStore(db, urlFetcher, siteStore);
  });

  it("returns empty results for a site with no scrapes", () => {
    siteStore.createSite(makeSiteConfig("test", ["https://example.com"]));
    const results = scrapeStore.getResults("test");
    expect(results).toHaveLength(0);
  });

  it("rescrapes a URL source and stores success result", async () => {
    siteStore.createSite(makeSiteConfig("test", ["https://example.com/page"]));
    vi.mocked(urlFetcher.fetch).mockResolvedValue("Hello world content");

    const result = await scrapeStore.rescrape("test", 0);

    expect(result.status).toBe("success");
    expect(result.contentLength).toBe(19);
    expect(result.wordCount).toBe(3);
    expect(result.contentPreview).toBe("Hello world content");
    expect(urlFetcher.invalidate).toHaveBeenCalledWith("https://example.com/page");
  });

  it("stores error result when fetch returns null", async () => {
    siteStore.createSite(makeSiteConfig("test", ["https://example.com/broken"]));
    vi.mocked(urlFetcher.fetch).mockResolvedValue(null);

    const result = await scrapeStore.rescrape("test", 0);

    expect(result.status).toBe("error");
    expect(result.errorMessage).toBe("Fetch returned no content");
  });

  it("stores error result when fetch throws", async () => {
    siteStore.createSite(makeSiteConfig("test", ["https://example.com/fail"]));
    vi.mocked(urlFetcher.fetch).mockRejectedValue(new Error("Network timeout"));

    const result = await scrapeStore.rescrape("test", 0);

    expect(result.status).toBe("error");
    expect(result.errorMessage).toBe("Network timeout");
  });

  it("throws for non-URL source index", async () => {
    siteStore.createSite({
      ...makeSiteConfig("test", []),
      knowledge: {
        sources: [{ type: "text", title: "Note", content: "Hello" }],
      },
    });

    await expect(scrapeStore.rescrape("test", 0)).rejects.toThrow("No URL source at index 0");
  });

  it("throws for unknown site", async () => {
    await expect(scrapeStore.rescrape("nonexistent", 0)).rejects.toThrow("Site not found");
  });

  it("persists results and retrieves them via getResults", async () => {
    siteStore.createSite(makeSiteConfig("test", ["https://a.com", "https://b.com"]));
    vi.mocked(urlFetcher.fetch).mockResolvedValue("Content");

    await scrapeStore.rescrape("test", 0);
    await scrapeStore.rescrape("test", 1);

    const results = scrapeStore.getResults("test");
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe("https://a.com");
    expect(results[1].url).toBe("https://b.com");
  });

  it("upserts on re-scrape (no duplicates)", async () => {
    siteStore.createSite(makeSiteConfig("test", ["https://example.com"]));
    vi.mocked(urlFetcher.fetch).mockResolvedValue("First");

    await scrapeStore.rescrape("test", 0);
    vi.mocked(urlFetcher.fetch).mockResolvedValue("Second version");
    await scrapeStore.rescrape("test", 0);

    const results = scrapeStore.getResults("test");
    expect(results).toHaveLength(1);
    expect(results[0].contentPreview).toBe("Second version");
  });

  it("scrapeAllForSite scrapes all URL sources", async () => {
    siteStore.createSite(makeSiteConfig("test", ["https://a.com", "https://b.com"]));
    vi.mocked(urlFetcher.fetch).mockResolvedValue("Content");

    const results = await scrapeStore.scrapeAllForSite("test");
    expect(results).toHaveLength(2);
    expect(urlFetcher.fetch).toHaveBeenCalledTimes(2);
  });
});
