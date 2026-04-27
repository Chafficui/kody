import type Database from "better-sqlite3";
import type { UrlFetcher } from "./knowledge/url-fetcher.js";
import type { SiteStore } from "./site-store.js";

export interface ScrapeResult {
  id: number;
  siteId: string;
  sourceIndex: number;
  url: string;
  status: "pending" | "success" | "error";
  contentPreview: string | null;
  contentLength: number;
  wordCount: number;
  errorMessage: string | null;
  scrapedAt: string | null;
}

export class ScrapeStore {
  constructor(
    private db: Database.Database,
    private urlFetcher: UrlFetcher,
    private siteStore: SiteStore,
  ) {}

  getResults(siteId: string): ScrapeResult[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM scrape_results WHERE site_id = ? ORDER BY source_index ASC",
      )
      .all(siteId) as Array<{
      id: number;
      site_id: string;
      source_index: number;
      url: string;
      status: string;
      content_preview: string | null;
      content_length: number;
      word_count: number;
      error_message: string | null;
      scraped_at: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      siteId: r.site_id,
      sourceIndex: r.source_index,
      url: r.url,
      status: r.status as ScrapeResult["status"],
      contentPreview: r.content_preview,
      contentLength: r.content_length,
      wordCount: r.word_count,
      errorMessage: r.error_message,
      scrapedAt: r.scraped_at,
    }));
  }

  async rescrape(siteId: string, sourceIndex: number): Promise<ScrapeResult> {
    const config = this.siteStore.getSiteConfig(siteId);
    if (!config) throw new Error(`Site not found: ${siteId}`);

    const source = config.knowledge.sources[sourceIndex];
    if (!source || source.type !== "url") {
      throw new Error(`No URL source at index ${sourceIndex}`);
    }

    this.urlFetcher.invalidate(source.url);

    this.upsertPending(siteId, sourceIndex, source.url);

    try {
      const content = await this.urlFetcher.fetch(
        source.url,
        source.refreshIntervalHours,
        source.enableJsRendering,
      );

      if (content) {
        return this.upsertSuccess(siteId, sourceIndex, source.url, content);
      }
      return this.upsertError(siteId, sourceIndex, source.url, "Fetch returned no content");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return this.upsertError(siteId, sourceIndex, source.url, message);
    }
  }

  async scrapeAllForSite(siteId: string): Promise<ScrapeResult[]> {
    const config = this.siteStore.getSiteConfig(siteId);
    if (!config) throw new Error(`Site not found: ${siteId}`);

    const results: ScrapeResult[] = [];
    for (let i = 0; i < config.knowledge.sources.length; i++) {
      const source = config.knowledge.sources[i];
      if (source.type !== "url") continue;

      this.upsertPending(siteId, i, source.url);

      try {
        const content = await this.urlFetcher.fetch(
          source.url,
          source.refreshIntervalHours,
          source.enableJsRendering,
        );
        if (content) {
          results.push(this.upsertSuccess(siteId, i, source.url, content));
        } else {
          results.push(this.upsertError(siteId, i, source.url, "Fetch returned no content"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push(this.upsertError(siteId, i, source.url, message));
      }
    }
    return results;
  }

  private upsertPending(siteId: string, sourceIndex: number, url: string): void {
    this.db
      .prepare(
        `INSERT INTO scrape_results (site_id, source_index, url, status)
         VALUES (?, ?, ?, 'pending')
         ON CONFLICT(site_id, source_index) DO UPDATE SET
           url = excluded.url, status = 'pending', error_message = NULL`,
      )
      .run(siteId, sourceIndex, url);
  }

  private upsertSuccess(
    siteId: string,
    sourceIndex: number,
    url: string,
    content: string,
  ): ScrapeResult {
    const preview = content.slice(0, 500);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO scrape_results (site_id, source_index, url, status, content_preview, content_length, word_count, scraped_at)
         VALUES (?, ?, ?, 'success', ?, ?, ?, ?)
         ON CONFLICT(site_id, source_index) DO UPDATE SET
           url = excluded.url, status = 'success', content_preview = excluded.content_preview,
           content_length = excluded.content_length, word_count = excluded.word_count,
           scraped_at = excluded.scraped_at, error_message = NULL`,
      )
      .run(siteId, sourceIndex, url, preview, content.length, wordCount, now);

    return {
      id: 0,
      siteId,
      sourceIndex,
      url,
      status: "success",
      contentPreview: preview,
      contentLength: content.length,
      wordCount,
      errorMessage: null,
      scrapedAt: now,
    };
  }

  private upsertError(
    siteId: string,
    sourceIndex: number,
    url: string,
    errorMessage: string,
  ): ScrapeResult {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO scrape_results (site_id, source_index, url, status, error_message, scraped_at)
         VALUES (?, ?, ?, 'error', ?, ?)
         ON CONFLICT(site_id, source_index) DO UPDATE SET
           url = excluded.url, status = 'error', error_message = excluded.error_message,
           scraped_at = excluded.scraped_at`,
      )
      .run(siteId, sourceIndex, url, errorMessage, now);

    return {
      id: 0,
      siteId,
      sourceIndex,
      url,
      status: "error",
      contentPreview: null,
      contentLength: 0,
      wordCount: 0,
      errorMessage,
      scrapedAt: now,
    };
  }
}
