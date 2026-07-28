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
    cache.set(sampleInput(), "hello");
    expect(cache.get(sampleInput())).toBeNull();
    expect(cache.isEnabled()).toBe(false);
  });

  it("stores and retrieves an entry when enabled", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput(), "Sure — here's how to pay your bill.");
    const hit = cache.get(sampleInput());
    expect(hit).not.toBeNull();
    expect(hit?.content).toBe("Sure — here's how to pay your bill.");
  });

  it("returns null on a miss", () => {
    cache = new ResponseCache(enabledConfig);
    expect(cache.get(sampleInput())).toBeNull();
  });

  it("expires entries after the configured TTL", () => {
    cache = new ResponseCache({ ...enabledConfig, ttlSeconds: 60 });
    cache.set(sampleInput(), "first");
    expect(cache.get(sampleInput())?.content).toBe("first");
    vi.advanceTimersByTime(61_000);
    expect(cache.get(sampleInput())).toBeNull();
  });

  it("treats temperature differences below 0.1 as the same key", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ temperature: 0.71 }), "hot");
    const hit = cache.get(sampleInput({ temperature: 0.70001 }));
    expect(hit?.content).toBe("hot");
  });

  it("treats temperature differences >= 0.1 as different keys", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ temperature: 0.7 }), "cool");
    const hit = cache.get(sampleInput({ temperature: 0.8 }));
    expect(hit).toBeNull();
  });

  it("treats different lastUserMessage as different keys", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ lastUserMessage: "A" }), "ans A");
    expect(cache.get(sampleInput({ lastUserMessage: "B" }))).toBeNull();
  });

  it("treats different last4MessagesHash as different keys", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ last4MessagesHash: "h1" }), "ans1");
    expect(cache.get(sampleInput({ last4MessagesHash: "h2" }))).toBeNull();
  });

  it("keeps separate entries per site", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ siteId: "site-a" }), "for a");
    cache.set(sampleInput({ siteId: "site-b" }), "for b");
    expect(cache.get(sampleInput({ siteId: "site-a" }))?.content).toBe("for a");
    expect(cache.get(sampleInput({ siteId: "site-b" }))?.content).toBe("for b");
    expect(cache.size("site-a")).toBe(1);
    expect(cache.size("site-b")).toBe(1);
  });

  it("evicts the oldest entry when maxEntries is exceeded (LRU)", () => {
    cache = new ResponseCache({ ...enabledConfig, maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      cache.set(
        sampleInput({ lastUserMessage: `q-${i}`, last4MessagesHash: `h-${i}` }),
        `a-${i}`,
      );
    }
    expect(cache.size("site-1")).toBe(3);
    // First two should have been evicted
    expect(cache.get(sampleInput({ lastUserMessage: "q-0", last4MessagesHash: "h-0" }))).toBeNull();
    expect(cache.get(sampleInput({ lastUserMessage: "q-1", last4MessagesHash: "h-1" }))).toBeNull();
    // Most recent should still be present
    expect(cache.get(sampleInput({ lastUserMessage: "q-4", last4MessagesHash: "h-4" }))?.content).toBe(
      "a-4",
    );
  });

  it("refreshes recency on get (LRU)", () => {
    cache = new ResponseCache({ ...enabledConfig, maxEntries: 2 });
    cache.set(sampleInput({ lastUserMessage: "a", last4MessagesHash: "h-a" }), "1");
    cache.set(sampleInput({ lastUserMessage: "b", last4MessagesHash: "h-b" }), "2");
    // Touch "a" so it becomes the most-recently-used.
    expect(cache.get(sampleInput({ lastUserMessage: "a", last4MessagesHash: "h-a" }))?.content).toBe(
      "1",
    );
    // Insert a third entry; "b" should now be evicted, not "a".
    cache.set(sampleInput({ lastUserMessage: "c", last4MessagesHash: "h-c" }), "3");
    expect(cache.get(sampleInput({ lastUserMessage: "a", last4MessagesHash: "h-a" }))?.content).toBe(
      "1",
    );
    expect(cache.get(sampleInput({ lastUserMessage: "b", last4MessagesHash: "h-b" }))).toBeNull();
    expect(cache.get(sampleInput({ lastUserMessage: "c", last4MessagesHash: "h-c" }))?.content).toBe(
      "3",
    );
  });

  it("clear(siteId) drops only the given site", () => {
    cache = new ResponseCache(enabledConfig);
    cache.set(sampleInput({ siteId: "site-a" }), "for a");
    cache.set(sampleInput({ siteId: "site-b" }), "for b");
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
