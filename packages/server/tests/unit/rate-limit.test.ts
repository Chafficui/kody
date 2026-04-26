import { describe, it, expect, afterEach } from "vitest";
import { RateLimiter } from "../../src/middleware/rate-limit.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("allows requests under the limit", () => {
    limiter = new RateLimiter();
    const config = { messagesPerMinute: 5, messagesPerHour: 100, messagesPerDay: 1000 };
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("key-1", config);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks when per-minute limit is reached", () => {
    limiter = new RateLimiter();
    const config = { messagesPerMinute: 3, messagesPerHour: 100, messagesPerDay: 1000 };

    for (let i = 0; i < 3; i++) {
      limiter.check("key-1", config);
    }

    const result = limiter.check("key-1", config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it("tracks keys independently", () => {
    limiter = new RateLimiter();
    const config = { messagesPerMinute: 2, messagesPerHour: 100, messagesPerDay: 1000 };

    limiter.check("key-1", config);
    limiter.check("key-1", config);
    const blocked = limiter.check("key-1", config);
    expect(blocked.allowed).toBe(false);

    const other = limiter.check("key-2", config);
    expect(other.allowed).toBe(true);
  });

  it("blocks when per-hour limit is reached", () => {
    limiter = new RateLimiter();
    const config = { messagesPerMinute: 1000, messagesPerHour: 5, messagesPerDay: 1000 };

    for (let i = 0; i < 5; i++) {
      limiter.check("key-1", config);
    }

    const result = limiter.check("key-1", config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(3600);
  });
});
