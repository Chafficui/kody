import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { SiteStore } from "../../src/services/site-store.js";
import { createSiteAuth } from "../../src/middleware/site-auth.js";

const validConfig = {
  siteId: "test-site",
  allowedOrigins: ["https://example.com", "https://staging.example.com"],
  ai: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  guardrails: {
    allowedTopics: ["billing"],
    topicDescription: "Help with billing.",
  },
};

describe("site-auth middleware", () => {
  let db: Database.Database;
  let store: SiteStore;
  let app: express.Express;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    store = new SiteStore(db);
    store.createSite(validConfig);

    app = express();
    app.use(express.json());
    app.use(createSiteAuth(store));
    app.get("/test", (req, res) => {
      res.json({ siteId: req.siteConfig?.siteId });
    });
  });

  afterEach(() => {
    db.close();
  });

  it("returns 400 without x-kody-site-id header", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown site", async () => {
    const res = await request(app).get("/test").set("x-kody-site-id", "nonexistent");
    expect(res.status).toBe(404);
  });

  it("passes through with valid siteId and matching origin", async () => {
    const res = await request(app)
      .get("/test")
      .set("x-kody-site-id", "test-site")
      .set("Origin", "https://example.com");
    expect(res.status).toBe(200);
    expect(res.body.siteId).toBe("test-site");
  });

  it("passes through with valid siteId and no origin (server-to-server)", async () => {
    const res = await request(app).get("/test").set("x-kody-site-id", "test-site");
    expect(res.status).toBe(200);
  });

  it("returns 403 for mismatched origin", async () => {
    const res = await request(app)
      .get("/test")
      .set("x-kody-site-id", "test-site")
      .set("Origin", "https://evil.com");
    expect(res.status).toBe(403);
  });

  it("accepts any of the allowed origins", async () => {
    const res = await request(app)
      .get("/test")
      .set("x-kody-site-id", "test-site")
      .set("Origin", "https://staging.example.com");
    expect(res.status).toBe(200);
  });

  it("attaches siteConfig to the request", async () => {
    const res = await request(app)
      .get("/test")
      .set("x-kody-site-id", "test-site")
      .set("Origin", "https://example.com");
    expect(res.body.siteId).toBe("test-site");
  });
});
