import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { createApp } from "../../src/app.js";

describe("OpenAPI routes", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  });

  afterEach(() => {
    db.close();
  });

  it("serves /openapi.yaml with the generated spec", async () => {
    const app = createApp({ db });
    const res = await request(app).get("/openapi.yaml");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/yaml/);
    // Smoke-check that we got a real OpenAPI document.
    expect(res.text).toMatch(/^openapi:\s*3\.1\.0/m);
    expect(res.text).toContain("/health");
    expect(res.text).toContain("/api/chat");
    expect(res.text).toContain("SiteConfig");
  });

  it("serves /openapi.json with the parsed spec", async () => {
    const app = createApp({ db });
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths["/health"]).toBeDefined();
    expect(res.body.paths["/api/chat"]).toBeDefined();
    expect(res.body.paths["/api/admin/sites"]).toBeDefined();
    expect(res.body.components.schemas.SiteConfig).toBeDefined();
  });
});
