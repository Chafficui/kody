import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const MAX_CONTENT_LENGTH = 50_000;
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  content: string;
  fetchedAt: number;
  contentPreview: string;
}

interface FetchResult {
  body: string;
  isHtml: boolean;
}

export interface ScrapeInfo {
  fetchedAt: number | null;
  contentLength: number | null;
  contentPreview: string | null;
}

function extractContent(html: string): string {
  const { document } = parseHTML(html);

  const reader = new Readability(document as unknown as Document);
  const article = reader.parse();

  if (article?.textContent) {
    return article.textContent.replace(/\s+/g, " ").trim();
  }

  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]*>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export class UrlFetcher {
  private cache = new Map<string, CacheEntry>();

  async fetch(
    url: string,
    refreshIntervalHours: number,
    enableJsRendering = true,
  ): Promise<string | null> {
    const cached = this.cache.get(url);
    const ttlMs = refreshIntervalHours * 60 * 60 * 1000;

    if (cached && Date.now() - cached.fetchedAt < ttlMs) {
      return cached.content;
    }

    try {
      let content: string;

      if (enableJsRendering) {
        const html = await this.fetchWithBrowser(url);
        content = extractContent(html);
      } else {
        const result = await this.fetchWithHttp(url);
        content = result.isHtml ? extractContent(result.body) : result.body;
      }

      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.slice(0, MAX_CONTENT_LENGTH);
      }

      const contentPreview = content.slice(0, 500);
      this.cache.set(url, { content, fetchedAt: Date.now(), contentPreview });
      return content;
    } catch {
      return cached?.content ?? null;
    }
  }

  private async fetchWithHttp(url: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      const isHtml = contentType.includes("html");
      return { body: await response.text(), isHtml };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchWithBrowser(url: string): Promise<string> {
    try {
      const moduleName = "playwright";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pw: any = await import(/* webpackIgnore: true */ moduleName);
      const browser = await pw.chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
        return await page.content();
      } finally {
        await browser.close();
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message.includes("Cannot find module") ||
          err.message.includes("Cannot find package"))
      ) {
        console.warn(
          "[url-fetcher] Playwright not installed, falling back to HTTP fetch",
        );
        const result = await this.fetchWithHttp(url);
        return result.body;
      }
      throw err;
    }
  }

  invalidate(url: string): void {
    this.cache.delete(url);
  }

  getLastScrape(url: string): ScrapeInfo {
    const entry = this.cache.get(url);
    return entry
      ? {
          fetchedAt: entry.fetchedAt,
          contentLength: entry.content.length,
          contentPreview: entry.contentPreview,
        }
      : { fetchedAt: null, contentLength: null, contentPreview: null };
  }
}
