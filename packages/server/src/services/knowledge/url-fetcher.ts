const MAX_CONTENT_LENGTH = 50_000;
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  content: string;
  fetchedAt: number;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function stripHtml(html: string): string {
  let text = html.replace(/<[^>]*>/g, " ");
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, char);
  }
  // Decode numeric entities (&#123; and &#x1a;)
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export class UrlFetcher {
  private cache = new Map<string, CacheEntry>();

  async fetch(url: string, refreshIntervalHours: number): Promise<string | null> {
    const cached = this.cache.get(url);
    const ttlMs = refreshIntervalHours * 60 * 60 * 1000;

    if (cached && Date.now() - cached.fetchedAt < ttlMs) {
      return cached.content;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return cached?.content ?? null;
      }

      let content = await response.text();

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("html")) {
        content = stripHtml(content);
      }

      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.slice(0, MAX_CONTENT_LENGTH);
      }

      this.cache.set(url, { content, fetchedAt: Date.now() });
      return content;
    } catch {
      return cached?.content ?? null;
    }
  }
}
