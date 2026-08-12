import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { createApp } from "../../src/app.js";
import { SiteStore } from "../../src/services/site-store.js";
import {
  buildDemoAllowedOrigins,
  buildDemoSiteConfig,
  seedDemoSite,
} from "../../src/seed-demo.js";
import type { Env } from "../../src/env.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    PORT: 3456,
    NODE_ENV: "test",
    DATABASE_PATH: ":memory:",
    CORS_ALLOW_ALL_DEV: false,
    LOG_LEVEL: "info",
    ...overrides,
  } as Env;
}

describe("buildDemoAllowedOrigins", () => {
  it("includes the server's own port and the common dev ports", () => {
    const env = makeEnv({ PORT: 4000 });
    const origins = buildDemoAllowedOrigins(env);
    expect(origins).toContain("http://localhost:4000");
    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://localhost:3001");
    expect(origins).toContain("http://localhost:4567");
  });

  it("appends PUBLIC_APP_URL when set", () => {
    const env = makeEnv({
      PORT: 3456,
      PUBLIC_APP_URL: "https://kody.example.com",
    });
    const origins = buildDemoAllowedOrigins(env);
    expect(origins).toContain("https://kody.example.com");
    // Localhost origins are preserved alongside the public origin.
    expect(origins).toContain("http://localhost:3456");
  });

  it("omits PUBLIC_APP_URL when unset", () => {
    const env = makeEnv({ PORT: 3456 });
    const origins = buildDemoAllowedOrigins(env);
    expect(origins.every((o) => !o.startsWith("https://"))).toBe(true);
  });
});

describe("buildDemoSiteConfig", () => {
  it("uses the canonical demo siteId", () => {
    const env = makeEnv();
    const config = buildDemoSiteConfig(env);
    expect(config.siteId).toBe("demo");
  });

  it("wires allowedOrigins through the public origin helper", () => {
    const env = makeEnv({
      PORT: 3456,
      PUBLIC_APP_URL: "https://demo.example.com",
    });
    const config = buildDemoSiteConfig(env);
    expect(config.allowedOrigins).toEqual(buildDemoAllowedOrigins(env));
  });
});

describe("seedDemoSite", () => {
  let db: Database.Database;
  let store: SiteStore;

  beforeEach(() => {
    db = createTestDb();
    store = new SiteStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates site 'demo' with all expected localhost origins on a fresh database", () => {
    const env = makeEnv({ PORT: 4000 });
    const created = seedDemoSite(store, env);
    expect(created).toBe(true);

    const site = store.getSiteConfig("demo");
    expect(site).not.toBeNull();
    expect(site!.siteId).toBe("demo");
    expect(site!.allowedOrigins).toContain("http://localhost:4000");
    expect(site!.allowedOrigins).toContain("http://localhost:3000");
    expect(site!.allowedOrigins).toContain("http://localhost:3001");
    expect(site!.allowedOrigins).toContain("http://localhost:4567");
  });

  it("includes PUBLIC_APP_URL in the seeded allowedOrigins when set", () => {
    const env = makeEnv({
      PORT: 3456,
      PUBLIC_APP_URL: "https://kody.example.com",
    });
    seedDemoSite(store, env);
    const site = store.getSiteConfig("demo");
    expect(site!.allowedOrigins).toContain("https://kody.example.com");
  });

  it("is idempotent: a second call is a no-op", () => {
    const env = makeEnv();
    expect(seedDemoSite(store, env)).toBe(true);
    expect(seedDemoSite(store, env)).toBe(false);
  });

  it("returns false and logs the error when createSite throws", () => {
    const env = makeEnv();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(store, "createSite").mockImplementation(() => {
      throw new Error("db write failed");
    });

    const created = seedDemoSite(store, env);

    expect(created).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    const firstCallArgs = consoleSpy.mock.calls[0];
    expect(String(firstCallArgs[0])).toContain("Failed to seed demo site");

    consoleSpy.mockRestore();
  });

  it("preserves a disabled demo record across repeated seed calls (warm cache)", () => {
    // Regression: seedDemoSite used to fall through to createSite whenever
    // getSiteConfig returned null. Because getSiteConfig filters disabled
    // sites, every server restart for an operator who disabled the demo
    // would hit a UNIQUE constraint and log a misleading "Failed to seed
    // demo site" error. The fix preserves the disabled state instead.
    const env = makeEnv();
    expect(seedDemoSite(store, env)).toBe(true);

    // Operator disables the demo via the admin dashboard (or direct SQL).
    const disabledConfig = { ...buildDemoSiteConfig(env), enabled: false };
    store.updateSite("demo", disabledConfig);
    expect(store.getSiteConfig("demo")).toBeNull();

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // Two simulated restarts in a row. Each must return false, leave
      // the demo disabled, and not log a seed error.
      expect(seedDemoSite(store, env)).toBe(false);
      expect(seedDemoSite(store, env)).toBe(false);

      const seedErrorCalls = consoleSpy.mock.calls.filter((call) =>
        String(call[0]).includes("Failed to seed demo site"),
      );
      expect(seedErrorCalls).toHaveLength(0);

      // Operator intent preserved: the demo is still disabled and the
      // runtime path (getSiteConfig) still hides it.
      expect(store.getSiteConfig("demo")).toBeNull();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("preserves a pre-existing disabled demo record on cold startup", () => {
    // Regression: same root cause, but with an empty in-memory cache to
    // simulate a fresh process whose database already contains a
    // disabled demo record. hasSiteRecord must hit the DB and the
    // seeder must short-circuit before calling createSite.
    const env = makeEnv();
    const disabledConfig = { ...buildDemoSiteConfig(env), enabled: false };
    store.createSite(disabledConfig);

    // Fresh SiteStore instance over the same DB = empty cache.
    const freshStore = new SiteStore(db);
    expect(freshStore.getSiteConfig("demo")).toBeNull();
    expect(freshStore.hasSiteRecord("demo")).toBe(true);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(seedDemoSite(freshStore, env)).toBe(false);

      const seedErrorCalls = consoleSpy.mock.calls.filter((call) =>
        String(call[0]).includes("Failed to seed demo site"),
      );
      expect(seedErrorCalls).toHaveLength(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("exposes a public projection that uses the same demo siteId", async () => {
    const env = makeEnv();
    seedDemoSite(store, env);
    const app = createApp({ db });
    const res = await request(app).get("/api/config/demo");
    expect(res.status).toBe(200);
    expect(res.body.siteId).toBe("demo");
    // The public projection must not leak AI provider config
    // (apiKey / baseUrl / model) to the browser.
    expect(res.body.ai).toBeUndefined();
  });
});
