import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { createApp } from "../../src/app.js";
import type { SiteStore } from "../../src/services/site-store.js";

const validConfig = {
  siteId: "test-site",
  allowedOrigins: ["https://example.com"],
  ai: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  guardrails: {
    allowedTopics: ["billing"],
    topicDescription: "Help with billing.",
  },
};

describe("GET /api/config/:siteId", () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let siteStore: SiteStore;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    app = createApp({ db });
    siteStore = (app as unknown as { siteStore: SiteStore }).siteStore;
    siteStore.createSite(validConfig);
  });

  afterEach(() => {
    db.close();
  });

  it("returns public config for existing site", async () => {
    const res = await request(app).get("/api/config/test-site");
    expect(res.status).toBe(200);
    expect(res.body.siteId).toBe("test-site");
    expect(res.body.branding.name).toBe("Assistant");
    expect(res.body.tickets).toBeDefined();
  });

  it("does not include sensitive fields", async () => {
    const res = await request(app).get("/api/config/test-site");
    expect(res.body.ai).toBeUndefined();
    expect(res.body.guardrails).toBeUndefined();
    expect(res.body.knowledge).toBeUndefined();
    expect(res.body.rateLimit).toBeUndefined();
  });

  it("returns 404 for unknown site", async () => {
    const res = await request(app).get("/api/config/nonexistent");
    expect(res.status).toBe(404);
  });
});
