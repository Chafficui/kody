import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UrlFetcher } from "../../../src/services/knowledge/url-fetcher.js";

describe("UrlFetcher", () => {
  let fetcher: UrlFetcher;

  beforeEach(() => {
    fetcher = new UrlFetcher();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockFetch(body: string, options?: { contentType?: string; ok?: boolean }) {
    const ok = options?.ok ?? true;
    const contentType = options?.contentType ?? "text/plain";
    vi.mocked(fetch).mockResolvedValue({
      ok,
      text: () => Promise.resolve(body),
      headers: new Headers({ "content-type": contentType }),
    } as Response);
  }

  it("fetches URL and returns content", async () => {
    mockFetch("Hello World");

    const result = await fetcher.fetch("https://example.com/docs", 24);

    expect(result).toBe("Hello World");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("strips HTML tags and decodes entities", async () => {
    const html = "<html><body><h1>Title</h1><p>Hello &amp; world &lt;3&gt;</p></body></html>";
    mockFetch(html, { contentType: "text/html; charset=utf-8" });

    const result = await fetcher.fetch("https://example.com/page", 24);

    expect(result).not.toContain("<h1>");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("&amp;");
    expect(result).toContain("Title");
    expect(result).toContain("Hello & world <3>");
  });

  it("returns cached content on cache hit", async () => {
    mockFetch("First fetch");

    const first = await fetcher.fetch("https://example.com/docs", 1);
    const second = await fetcher.fetch("https://example.com/docs", 1);

    expect(first).toBe("First fetch");
    expect(second).toBe("First fetch");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("re-fetches after cache expires", async () => {
    mockFetch("First");
    await fetcher.fetch("https://example.com/docs", 1);

    // Advance past the 1-hour TTL
    vi.advanceTimersByTime(61 * 60 * 1000);

    mockFetch("Second");
    const result = await fetcher.fetch("https://example.com/docs", 1);

    expect(result).toBe("Second");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns stale cached content on fetch failure", async () => {
    mockFetch("Cached content");
    await fetcher.fetch("https://example.com/docs", 1);

    // Expire the cache
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);

    // Next fetch fails
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    const result = await fetcher.fetch("https://example.com/docs", 1);

    expect(result).toBe("Cached content");
  });

  it("returns null on fetch failure with no cache", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const result = await fetcher.fetch("https://example.com/docs", 24);

    expect(result).toBeNull();
  });

  it("returns cached content on non-ok response", async () => {
    mockFetch("Cached");
    await fetcher.fetch("https://example.com/docs", 1);

    vi.advanceTimersByTime(2 * 60 * 60 * 1000);

    mockFetch("Error page", { ok: false });
    const result = await fetcher.fetch("https://example.com/docs", 1);

    expect(result).toBe("Cached");
  });

  it("truncates content to 50,000 characters", async () => {
    const longContent = "x".repeat(60_000);
    mockFetch(longContent);

    const result = await fetcher.fetch("https://example.com/docs", 24);

    expect(result).toHaveLength(50_000);
  });
});
