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
  /**
   * Opaque fingerprint of the site configuration that produced
   * the cached reply. The caller (chat route) computes a stable
   * hash of the resolved system prompt plus the scrubbing /
   * refusal config so any change to personality, guardrails,
   * knowledge, or `ai.systemPromptPrefix` immediately invalidates
   * prior entries. Without this, a config update would silently
   * keep serving replies that were generated under the old
   * prompt until the TTL elapsed.
   */
  siteFingerprint: string;
}

interface InternalEntry {
  content: string;
  createdAt: number;
}

/**
 * One node in the global LRU list. The list is doubly-linked so
 * eviction and recency updates are O(1) without needing a separate
 * `createdAt` sort. `next === null` means "the tail of the list".
 */
interface LruNode {
  siteId: string;
  key: string;
  prev: LruNode | null;
  next: LruNode | null;
}

/**
 * Deployment-wide fallback for the fields a site may leave
 * unset on its own `cache` config. The per-site `enabled` flag
 * is intentionally absent — the constructor does not consult
 * it; callers pass the current site's full `config.cache` into
 * `isEnabled` / `get` / `set` so a single shared instance can
 * serve many sites, some with caching on and some off.
 */
export type ResponseCacheStorageConfig = {
  ttlSeconds?: number;
  maxEntries?: number;
};

/**
 * Bounded LRU response cache.
 *
 * Keys are derived from a hash of the request shape (see `buildKey`)
 * so we don't keep the original prompt in memory. Entries are stored
 * in a shared pool with **two independent caps**:
 *   1. **Per-site ring cap** — the writing site's `config.maxEntries`
 *      (with the deployment-wide `storageConfig.maxEntries` as a
 *      fallback). Enforced first so a site only ever evicts its own
 *      entries to fit its own cap, regardless of what other tenants
 *      are doing.
 *   2. **Global cap** — `storageConfig.maxEntries` (with a hard
 *      1000-entry fallback). Enforced second so the shared pool
 *      can never grow past the deployment-wide budget, even if a
 *      single chatty tenant would otherwise blow the memory limit.
 *
 * Without the per-site ring cap a chatty site could evict entries
 * from a quiet one on every write (because the eviction helper
 * used the global tail as the victim), and without the global cap
 * a tenant with an unlimited `maxEntries` would consume the entire
 * shared pool. Both caps are now enforced together.
 *
 * Behaviour:
 *   - `get` refreshes recency by moving the node to the head of the LRU list
 *   - `set` evicts within the writing site's ring first, then
 *     trims the global pool to its deployment-wide cap
 *   - Entries older than `ttlSeconds` are treated as misses and purged
 *   - Site rings are dropped when they become empty so inactive
 *     sites don't keep their ring resident
 */
export class ResponseCache {
  private rings = new Map<string, Map<string, InternalEntry>>();
  private head: LruNode | null = null;
  private tail: LruNode | null = null;
  private nodes = new Map<string, LruNode>();
  private totalEntries = 0;

  /**
   * Storage-level config. Holds only the deployment-wide
   * fallback for the *fields that aren't* (or can't be)
   * overridden per site: `ttlSeconds` and `maxEntries` (when
   * a site doesn't specify its own). The per-site `enabled`
   * flag is *not* part of this — callers pass the current
   * site's `config.cache` into `isEnabled` / `get` / `set`
   * so a single shared instance can serve many sites, some
   * with caching on and some off.
   */
  constructor(private storageConfig: ResponseCacheStorageConfig) {}

  /**
   * Returns true if the cache is enabled for the supplied site
   * config. The default in the schema is `enabled: false`, so this
   * is opt-in per site.
   */
  isEnabled(config: ResponseCacheConfig): boolean {
    return config.enabled === true;
  }

  /**
   * Look up an entry. Returns null on miss, expired entry, or when the
   * cache is disabled for the supplied site. On a hit, recency is
   * refreshed.
   */
  get(input: CacheKeyInput, config: ResponseCacheConfig): CacheEntry | null {
    if (!this.isEnabled(config)) return null;

    const ring = this.rings.get(input.siteId);
    if (!ring) return null;

    const key = buildKey(input);
    const entry = ring.get(key);
    if (!entry) {
      // The LRU list may have a stale node if the row was removed
      // from the ring; the next set() will reconcile.
      return null;
    }

    const ttlMs = (config.ttlSeconds ?? this.storageConfig.ttlSeconds ?? 3600) * 1000;
    if (Date.now() - entry.createdAt > ttlMs) {
      this.removeNode(input.siteId, key);
      return null;
    }

    this.touchNode(input.siteId, key);
    return { content: entry.content, createdAt: entry.createdAt };
  }

  /**
   * Store an entry. No-op when the cache is disabled for the
   * supplied site.
   */
  set(input: CacheKeyInput, config: ResponseCacheConfig, content: string): void {
    if (!this.isEnabled(config)) return;

    let ring = this.rings.get(input.siteId);
    if (!ring) {
      ring = new Map();
      this.rings.set(input.siteId, ring);
    }

    const key = buildKey(input);
    if (ring.has(key)) {
      // Update in place — no need to touch the LRU list size.
      ring.set(key, { content, createdAt: Date.now() });
      this.touchNode(input.siteId, key);
      return;
    }

    ring.set(key, { content, createdAt: Date.now() });
    this.totalEntries++;
    this.attachNode(input.siteId, key);

    this.evictIfOverCapacity(input.siteId, config);
  }

  /**
   * Drop all entries. Used by tests and on site deletion.
   */
  clear(siteId?: string): void {
    if (siteId === undefined) {
      this.rings.clear();
      this.head = null;
      this.tail = null;
      this.nodes.clear();
      this.totalEntries = 0;
      return;
    }
    const ring = this.rings.get(siteId);
    if (!ring) return;
    for (const key of ring.keys()) {
      this.unlinkNode(siteId, key);
    }
    this.rings.delete(siteId);
  }

  /**
   * For observability and tests: current entry count for a site.
   */
  size(siteId: string): number {
    return this.rings.get(siteId)?.size ?? 0;
  }

  /** For observability and tests: total entries across all sites. */
  totalSize(): number {
    return this.totalEntries;
  }

  private evictIfOverCapacity(siteId: string, siteConfig: ResponseCacheConfig): void {
    // Two distinct caps are enforced here:
    //   1. The **per-site ring** cap: the writing site's
    //      `maxEntries` (with the deployment-wide default as a
    //      fallback). When a site writes more than its own cap
    //      allows, the LRU victim must come from that site's own
    //      ring — never from a quiet neighbour.
    //   2. The **global** cap: `storageConfig.maxEntries` (with a
    //      hard 1000 fallback). The shared pool can never grow
    //      past this regardless of how many sites are writing,
    //      so a single chatty tenant can't blow the deployment's
    //      memory budget.
    // Resolved independently so a tiny per-site cap doesn't
    // shadow the deployment-wide global cap and vice versa.
    const siteMax = siteConfig.maxEntries ?? this.storageConfig.maxEntries ?? 1000;
    const globalMax = this.storageConfig.maxEntries ?? 1000;

    // 1. Evict within the writing site until its own ring is
    //    within its own cap. We walk the LRU list and skip nodes
    //    that belong to other sites — those will only be removed
    //    by the global cap below.
    const siteRing = this.rings.get(siteId);
    if (siteRing) {
      while (siteRing.size > siteMax && this.tail) {
        // Find the oldest node for THIS site. We can't just take
        // the global tail because it may belong to a different
        // site; scan from the tail inward.
        const victim = this.findOldestForSite(siteId);
        if (!victim) break;
        this.unlinkNode(victim.siteId, victim.key);
        siteRing.delete(victim.key);
        if (siteRing.size === 0) this.rings.delete(victim.siteId);
      }
    }

    // 2. Evict the global LRU tail until the shared pool fits the
    //    deployment-wide cap. The victim here may be from any
    //    site, not just the writing one — that's the whole point
    //    of a shared global bound.
    while (this.totalEntries > globalMax && this.tail) {
      const victim = this.tail;
      this.unlinkNode(victim.siteId, victim.key);
      const ring = this.rings.get(victim.siteId);
      ring?.delete(victim.key);
      if (ring && ring.size === 0) this.rings.delete(victim.siteId);
    }
  }

  /**
   * Walk the LRU list from the tail and return the oldest node
   * that belongs to the given site, or `null` if none exists.
   * The previous implementation skipped this step and used the
   * global tail as the eviction victim for *every* site, which
   * meant the last writing site decided which other tenant got
   * evicted. This helper restores the per-site ring as the
   * primary eviction unit so a site only ever evicts its own
   * entries to fit its own cap.
   */
  private findOldestForSite(siteId: string): LruNode | null {
    let cursor: LruNode | null = this.tail;
    while (cursor) {
      if (cursor.siteId === siteId) return cursor;
      cursor = cursor.prev;
    }
    return null;
  }

  private touchNode(siteId: string, key: string): void {
    const node = this.nodes.get(`${siteId}\u0000${key}`);
    if (!node) {
      this.attachNode(siteId, key);
      return;
    }
    if (node === this.head) return;
    this.detach(node);
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private attachNode(siteId: string, key: string): void {
    const id = `${siteId}\u0000${key}`;
    if (this.nodes.has(id)) return;
    const node: LruNode = { siteId, key, prev: null, next: this.head };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.nodes.set(id, node);
  }

  private detach(node: LruNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  private unlinkNode(siteId: string, key: string): void {
    const id = `${siteId}\u0000${key}`;
    const node = this.nodes.get(id);
    if (!node) return;
    this.detach(node);
    this.nodes.delete(id);
    this.totalEntries = Math.max(0, this.totalEntries - 1);
  }

  private removeNode(siteId: string, key: string): void {
    const ring = this.rings.get(siteId);
    if (ring) {
      ring.delete(key);
      if (ring.size === 0) this.rings.delete(siteId);
    }
    this.unlinkNode(siteId, key);
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
    .update("\u0000")
    .update(input.siteFingerprint)
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
