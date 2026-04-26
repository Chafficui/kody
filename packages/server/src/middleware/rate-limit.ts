import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  messagesPerMinute: number;
  messagesPerHour: number;
  messagesPerDay: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  check(key: string, config: RateLimitConfig): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const entry = this.store.get(key) || { timestamps: [] };

    const oneMinuteAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;
    const oneDayAgo = now - 86_400_000;

    entry.timestamps = entry.timestamps.filter((t) => t > oneDayAgo);

    const lastMinute = entry.timestamps.filter((t) => t > oneMinuteAgo).length;
    if (lastMinute >= config.messagesPerMinute) {
      return { allowed: false, retryAfterSeconds: 60 };
    }

    const lastHour = entry.timestamps.filter((t) => t > oneHourAgo).length;
    if (lastHour >= config.messagesPerHour) {
      return { allowed: false, retryAfterSeconds: 3600 };
    }

    const lastDay = entry.timestamps.length;
    if (lastDay >= config.messagesPerDay) {
      return { allowed: false, retryAfterSeconds: 86400 };
    }

    entry.timestamps.push(now);
    this.store.set(key, entry);
    return { allowed: true };
  }

  private cleanup(): void {
    const oneDayAgo = Date.now() - 86_400_000;
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > oneDayAgo);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

export function createRateLimitMiddleware(rateLimiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const config = req.siteConfig;
    if (!config) {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${config.siteId}:${ip}`;

    const result = rateLimiter.check(key, config.rateLimit);
    if (!result.allowed) {
      res.status(429).json({ error: { message: "Rate limit exceeded" } });
      if (result.retryAfterSeconds) {
        res.set("Retry-After", String(result.retryAfterSeconds));
      }
      return;
    }

    next();
  };
}
