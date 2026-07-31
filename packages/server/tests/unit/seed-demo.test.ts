import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

  it("exposes a public projection that uses the same demo siteId", async () => {
    const env = makeEnv();
    seedDemoSite(store, env);
    const app = createApp({ db });
    const res = await request(app).get("/api/config/demo");
    expect(res.status).toBe(200);
    expect(res.body.siteId).toBe("demo");
  });
});
