import { createHash } from "node:crypto";
import type { ResponseCacheConfig } from "@kody/shared";

/**
 * Stored value for a cache hit. We deliberately keep the schema
 * minimal: just the assistant's final content and when it was cached.
 * Tool-using turns are not cached (see `isCacheable`), so we never
 * have to worry about replaying tool calls.
 */
export interface CacheEntry {
  content: string;
  createdAt: number;
}

export interface CacheKeyInput {
  siteId: string;
  model: string;
  temperature: number;
  lastUserMessage: string;
  /** Hash of the last 4 messages; the caller computes this. */
  last4MessagesHash: string;
}

interface InternalEntry {
  key: string;
  content: string;
  createdAt: number;
}

/**
 * Bounded LRU response cache, scoped per site.
 *
 * Keys are derived from a hash of the request shape (see `buildKey`)
 * so we don't keep the original prompt in memory. Each site has its
 * own LRU ring so a chatty site can't evict entries from a quiet one.
 *
 * Behaviour:
 *   - `get` refreshes recency (deletes + re-inserts to the end of the Map)
 *   - `set` evicts the oldest entry when `maxEntries` is exceeded
 *   - Entries older than `ttlSeconds` are treated as misses and purged
 */
export class ResponseCache {
  private sites = new Map<string, Map<string, InternalEntry>>();

  constructor(private config: ResponseCacheConfig) {}

  /**
   * Returns true if the cache is enabled. The default in the schema is
   * `enabled: false`, so this is opt-in.
   */
  isEnabled(): boolean {
    return this.config.enabled === true;
  }

  /**
   * Look up an entry. Returns null on miss, expired entry, or when the
   * cache is disabled. On a hit, recency is refreshed.
   */
  get(input: CacheKeyInput): CacheEntry | null {
    if (!this.isEnabled()) return null;

    const ring = this.sites.get(input.siteId);
    if (!ring) return null;

    const key = buildKey(input);
    const entry = ring.get(key);
    if (!entry) return null;

    const ttlMs = (this.config.ttlSeconds ?? 3600) * 1000;
    if (Date.now() - entry.createdAt > ttlMs) {
      ring.delete(key);
      if (ring.size === 0) this.sites.delete(input.siteId);
      return null;
    }

    // Refresh recency by re-inserting at the end of the Map.
    ring.delete(key);
    ring.set(key, entry);
    return { content: entry.content, createdAt: entry.createdAt };
  }

  /**
   * Store an entry. No-op when the cache is disabled.
   */
  set(input: CacheKeyInput, content: string): void {
    if (!this.isEnabled()) return;

    let ring = this.sites.get(input.siteId);
    if (!ring) {
      ring = new Map();
      this.sites.set(input.siteId, ring);
    }

    const key = buildKey(input);
    ring.set(key, {
      key,
      content,
      createdAt: Date.now(),
    });

    this.evictIfOverCapacity(ring);
  }

  /**
   * Drop all entries. Used by tests and on site deletion.
   */
  clear(siteId?: string): void {
    if (siteId === undefined) {
      this.sites.clear();
    } else {
      this.sites.delete(siteId);
    }
  }

  /**
   * For observability and tests: current entry count for a site.
   */
  size(siteId: string): number {
    return this.sites.get(siteId)?.size ?? 0;
  }

  private evictIfOverCapacity(ring: Map<string, InternalEntry>): void {
    const max = this.config.maxEntries ?? 1000;
    while (ring.size > max) {
      const oldestKey = ring.keys().next().value;
      if (oldestKey === undefined) break;
      ring.delete(oldestKey);
    }
  }
}

/**
 * Build a stable cache key from a normalized request slice.
 *
 * The temperature is rounded to one decimal place so e.g. 0.6999 and
 * 0.7001 hit the same key (matches the brief). The `last4MessagesHash`
 * is supplied by the caller — it is a SHA-256 of the conversation
 * tail — so we never store raw user content in the key.
 */
export function buildKey(input: CacheKeyInput): string {
  const tempRounded = Math.round(input.temperature * 10) / 10;
  return createHash("sha256")
    .update(input.siteId)
    .update("\u0000")
    .update(input.model)
    .update("\u0000")
    .update(String(tempRounded))
    .update("\u0000")
    .update(input.last4MessagesHash)
    .update("\u0000")
    .update(input.lastUserMessage)
    .digest("hex");
}

/**
 * Hash the last 4 messages of a conversation. Each message is encoded
 * as `<role>\u0001<content>` and the entries are joined with `\u0002`
 * — a non-printable separator so the hash is stable across different
 * newline styles.
 */
export function hashMessageTail(
  messages: Array<{ role: string; content: string }>,
  take = 4,
): string {
  const tail = messages.slice(-take);
  const h = createHash("sha256");
  for (const m of tail) {
    h.update(m.role);
    h.update("\u0001");
    h.update(m.content);
    h.update("\u0002");
  }
  return h.digest("hex");
}

/**
 * A turn is cacheable when:
 *   1. The cache is enabled (checked by the caller; we just enforce the rest)
 *   2. The supplied messages contain no tool calls (built-in or custom)
 *
 * Tool-using turns are intentionally excluded because the tool result
 * can change between identical user inputs (e.g. `create_ticket` would
 * produce a new ticket ID every time) and the assistant's reply after
 * the tool is usually a follow-up that depends on that tool output.
 */
export function isCacheable(
  messages: Array<{ role: string; tool_calls?: unknown[]; tool_call_id?: string }>,
): boolean {
  for (const m of messages) {
    if (m.role === "tool") return false;
    if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) return false;
  }
  return true;
}
