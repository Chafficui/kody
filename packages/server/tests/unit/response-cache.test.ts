import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ResponseCache,
  buildKey,
  hashMessageTail,
  isCacheable,
} from "../../src/services/response-cache.js";
import type { ResponseCacheConfig } from "@kody/shared";

const enabledConfig: ResponseCacheConfig = {
  enabled: true,
  ttlSeconds: 3600,
  maxEntries: 1000,
};

const disabledConfig: ResponseCacheConfig = {
  enabled: false,
  ttlSeconds: 3600,
  maxEntries: 1000,
};

function sampleInput(overrides: Partial<Parameters<ResponseCache["get"]>[0]> = {}) {
  return {
    siteId: "site-1",
    model: "llama3.2",
    temperature: 0.7,
    lastUserMessage: "How do I pay my bill?",
    last4MessagesHash: hashMessageTail([
      { role: "user", content: "previous turn" },
    ]),
    ...overrides,
  };
}

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    cache?.clear();
  });

  it("is a no-op when disabled", () => {
    cache = new ResponseCache(disabledConfig);
    cache.set(sampleInput(), disabledConfig, "hello");
    expect(cache.get(sampleInput(), disabledConfig)).toBeNull();
    expect(cache.isEnabled(disabledConfig)).toBe(false);
  });

  it("stores and retrieves an entry when enabled", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput(), enabledConfig, "Sure — here's how to pay your bill.");
    const hit = cache.get(sampleInput(), enabledConfig);
    expect(hit).not.toBeNull();
    expect(hit?.content).toBe("Sure — here's how to pay your bill.");
  });

  it("returns null on a miss", () => {
    cache = new ResponseCache(enabledConfig);
    expect(cache.get(sampleInput(), enabledConfig)).toBeNull();
  });

  it("expires entries after the configured TTL", () => {
    const cfg = { ...enabledConfig, ttlSeconds: 60 };
    cache = new ResponseCache(cfg);
    cache.set(sampleInput(), cfg, "first");
    expect(cache.get(sampleInput(), cfg)?.content).toBe("first");
    vi.advanceTimersByTime(61_000);
    expect(cache.get(sampleInput(), cfg)).toBeNull();
  });

  it("rounds temperature to one decimal place for the key", () => {
    // 0.71 and 0.70001 both round to 0.7 → same key.
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ temperature: 0.71 }), enabledConfig, "hot");
    const hit = cache.get(sampleInput({ temperature: 0.70001 }), enabledConfig);
    expect(hit?.content).toBe("hot");
  });

  it("treats temperatures whose rounded values differ as different keys", () => {
    // 0.7 rounds to 0.7; 0.8 rounds to 0.8 → different keys.
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ temperature: 0.7 }), enabledConfig, "cool");
    const hit = cache.get(sampleInput({ temperature: 0.8 }), enabledConfig);
    expect(hit).toBeNull();
  });

  it("boundary: 0.74 and 0.75 round to different decimal values", () => {
    // 0.74 rounds to 0.7; 0.75 rounds to 0.8 (banker's rounding
    // aside — JS `Math.round(0.75 * 10) / 10 === 0.8`).
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ temperature: 0.74 }), enabledConfig, "low");
    const hit = cache.get(sampleInput({ temperature: 0.75 }), enabledConfig);
    expect(hit).toBeNull();
  });

  it("treats different lastUserMessage as different keys", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ lastUserMessage: "A" }), enabledConfig, "ans A");
    expect(cache.get(sampleInput({ lastUserMessage: "B" }), enabledConfig)).toBeNull();
  });

  it("treats different last4MessagesHash as different keys", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ last4MessagesHash: "h1" }), enabledConfig, "ans1");
    expect(cache.get(sampleInput({ last4MessagesHash: "h2" }), enabledConfig)).toBeNull();
  });

  it("keeps separate entries per site", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ siteId: "site-a" }), enabledConfig, "for a");
    cache.set(sampleInput({ siteId: "site-b" }), enabledConfig, "for b");
    expect(cache.get(sampleInput({ siteId: "site-a" }), enabledConfig)?.content).toBe("for a");
    expect(cache.get(sampleInput({ siteId: "site-b" }), enabledConfig)?.content).toBe("for b");
    expect(cache.size("site-a")).toBe(1);
    expect(cache.size("site-b")).toBe(1);
  });

  it("evicts the oldest entry when maxEntries is exceeded (global LRU)", () => {
    const cfg = { ...enabledConfig, maxEntries: 3 };
    cache = new ResponseCache(cfg);
    for (let i = 0; i < 5; i++) {
      cache.set(
        sampleInput({ lastUserMessage: `q-${i}`, last4MessagesHash: `h-${i}` }),
        cfg,
        `a-${i}`,
      );
    }
    expect(cache.size("site-1")).toBe(3);
    // First two should have been evicted
    expect(
      cache.get(
        sampleInput({ lastUserMessage: "q-0", last4MessagesHash: "h-0" }),
        cfg,
      ),
    ).toBeNull();
    expect(
      cache.get(
        sampleInput({ lastUserMessage: "q-1", last4MessagesHash: "h-1" }),
        cfg,
      ),
    ).toBeNull();
    // Most recent should still be present
    expect(
      cache.get(
        sampleInput({ lastUserMessage: "q-4", last4MessagesHash: "h-4" }),
        cfg,
      )?.content,
    ).toBe("a-4");
  });

  it("evicts across sites using the per-site maxEntries (global LRU)", () => {
    // site-a's config asks for a small per-site cap; the deployment
    // default in storageConfig is *larger* so the per-site value
    // is what eviction must honor. site-b's per-site cap is the
    // same as the deployment default so the test can also verify
    // that the global LRU evicts site-a's oldest entry when a
    // site-b write pushes the pool over the cap.
    const siteA = { ...enabledConfig, maxEntries: 2 };
    const siteB = { ...enabledConfig, maxEntries: 3 };
    cache = new ResponseCache({ ...enabledConfig, maxEntries: 3 });

    // Fill the shared pool with 2 entries from site-a + 1 from
    // site-b. Total is 3, exactly at site-b's per-site cap and
    // the deployment cap.
    cache.set(sampleInput({ siteId: "site-a", lastUserMessage: "a1", last4MessagesHash: "ha1" }), siteA, "A1");
    cache.set(sampleInput({ siteId: "site-a", lastUserMessage: "a2", last4MessagesHash: "ha2" }), siteA, "A2");
    cache.set(sampleInput({ siteId: "site-b", lastUserMessage: "b1", last4MessagesHash: "hb1" }), siteB, "B1");
    expect(cache.totalSize()).toBe(3);

    // Add a second site-b entry. Total = 4 > site-b's per-site
    // cap (3), so the global LRU must evict site-a's *oldest*
    // entry (a1). site-b's per-site cap is the active one — not
    // the storageConfig default of 3 and not site-a's cap of 2 —
    // because eviction is invoked by site-b's `set`.
    cache.set(sampleInput({ siteId: "site-b", lastUserMessage: "b2", last4MessagesHash: "hb2" }), siteB, "B2");

    expect(cache.totalSize()).toBe(3);
    expect(
      cache.get(sampleInput({ siteId: "site-a", lastUserMessage: "a1", last4MessagesHash: "ha1" }), siteA),
    ).toBeNull();
    // The newer site-a entry must still be there — a different
    // site wrote, not site-a, so a2 is not the LRU victim.
    expect(
      cache.get(sampleInput({ siteId: "site-a", lastUserMessage: "a2", last4MessagesHash: "ha2" }), siteA)?.content,
    ).toBe("A2");
    // Both site-b entries remain.
    expect(
      cache.get(sampleInput({ siteId: "site-b", lastUserMessage: "b1", last4MessagesHash: "hb1" }), siteB)?.content,
    ).toBe("B1");
    expect(
      cache.get(sampleInput({ siteId: "site-b", lastUserMessage: "b2", last4MessagesHash: "hb2" }), siteB)?.content,
    ).toBe("B2");
  });

  it("honors per-site maxEntries even when smaller than the deployment default", () => {
    // The deployment default in storageConfig is 10 entries. The
    // site config asks for just 2. After the second site-a
    // insert, the per-site cap must take effect — the third
    // site-a insert must evict the first site-a entry, even
    // though 3 < 10 (the deployment default) would otherwise
    // allow it. This is the exact failure mode the previous
    // implementation had: it only looked at storageConfig and
    // ignored the per-site override.
    const siteA = { ...enabledConfig, maxEntries: 2 };
    cache = new ResponseCache({ ...enabledConfig, maxEntries: 10 });

    cache.set(sampleInput({ siteId: "site-a", lastUserMessage: "a1", last4MessagesHash: "ha1" }), siteA, "A1");
    cache.set(sampleInput({ siteId: "site-a", lastUserMessage: "a2", last4MessagesHash: "ha2" }), siteA, "A2");
    expect(cache.totalSize()).toBe(2);

    cache.set(sampleInput({ siteId: "site-a", lastUserMessage: "a3", last4MessagesHash: "ha3" }), siteA, "A3");

    expect(cache.totalSize()).toBe(2);
    expect(
      cache.get(sampleInput({ siteId: "site-a", lastUserMessage: "a1", last4MessagesHash: "ha1" }), siteA),
    ).toBeNull();
    expect(
      cache.get(sampleInput({ siteId: "site-a", lastUserMessage: "a2", last4MessagesHash: "ha2" }), siteA)?.content,
    ).toBe("A2");
    expect(
      cache.get(sampleInput({ siteId: "site-a", lastUserMessage: "a3", last4MessagesHash: "ha3" }), siteA)?.content,
    ).toBe("A3");
  });

  it("refreshes recency on get (LRU)", () => {
    const cfg = { ...enabledConfig, maxEntries: 2 };
    cache = new ResponseCache(cfg);
    cache.set(sampleInput({ lastUserMessage: "a", last4MessagesHash: "h-a" }), cfg, "1");
    cache.set(sampleInput({ lastUserMessage: "b", last4MessagesHash: "h-b" }), cfg, "2");
    // Touch "a" so it becomes the most-recently-used.
    expect(
      cache.get(
        sampleInput({ lastUserMessage: "a", last4MessagesHash: "h-a" }),
        cfg,
      )?.content,
    ).toBe("1");
    // Insert a third entry; "b" should now be evicted, not "a".
    cache.set(sampleInput({ lastUserMessage: "c", last4MessagesHash: "h-c" }), cfg, "3");
    expect(
      cache.get(
        sampleInput({ lastUserMessage: "a", last4MessagesHash: "h-a" }),
        cfg,
      )?.content,
    ).toBe("1");
    expect(
      cache.get(
        sampleInput({ lastUserMessage: "b", last4MessagesHash: "h-b" }),
        cfg,
      ),
    ).toBeNull();
    expect(
      cache.get(
        sampleInput({ lastUserMessage: "c", last4MessagesHash: "h-c" }),
        cfg,
      )?.content,
    ).toBe("3");
  });

  it("clear(siteId) drops only the given site", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ siteId: "site-a" }), enabledConfig, "for a");
    cache.set(sampleInput({ siteId: "site-b" }), enabledConfig, "for b");
    cache.clear("site-a");
    expect(cache.size("site-a")).toBe(0);
    expect(cache.size("site-b")).toBe(1);
  });
});

describe("hashMessageTail", () => {
  it("is stable across calls with the same input", () => {
    const a = hashMessageTail([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    const b = hashMessageTail([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    expect(a).toBe(b);
  });

  it("changes when any message changes", () => {
    const a = hashMessageTail([{ role: "user", content: "hi" }]);
    const b = hashMessageTail([{ role: "user", content: "hi there" }]);
    expect(a).not.toBe(b);
  });

  it("only hashes the last N messages", () => {
    const long = [
      { role: "user", content: "1" },
      { role: "user", content: "2" },
      { role: "user", content: "3" },
      { role: "user", content: "4" },
      { role: "user", content: "5" },
    ];
    const truncated = hashMessageTail([...long.slice(-4)]);
    const full = hashMessageTail(long, 4);
    expect(full).toBe(truncated);
  });
});

describe("isCacheable", () => {
  it("is true for a plain text conversation", () => {
    expect(
      isCacheable([
        { role: "system", content: "you are a bot" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ]),
    ).toBe(true);
  });

  it("is false when the conversation contains a tool result", () => {
    expect(
      isCacheable([
        { role: "user", content: "hi" },
        { role: "tool", content: "ticket-123", tool_call_id: "1" },
      ]),
    ).toBe(false);
  });

  it("is false when any assistant message has tool_calls", () => {
    expect(
      isCacheable([
        {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "1", function: { name: "x", arguments: "{}" } }],
        },
      ]),
    ).toBe(false);
  });
});

describe("buildKey", () => {
  it("produces a 64-char hex string", () => {
    const key = buildKey(sampleInput());
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores sub-0.1 temperature differences", () => {
    const k1 = buildKey(sampleInput({ temperature: 0.71 }));
    const k2 = buildKey(sampleInput({ temperature: 0.70001 }));
    expect(k1).toBe(k2);
  });
});
