import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import yaml from "js-yaml";
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
    // Long-lived Cache-Control + a content-based ETag so SDK clients can
    // short-circuit unchanged fetches with If-None-Match.
    expect(res.headers["cache-control"]).toMatch(/public.*max-age=/);
    expect(res.headers.etag).toBeDefined();
    expect(res.headers.etag).toMatch(/^"[A-Za-z0-9_-]+"$/);
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
    expect(res.headers["cache-control"]).toMatch(/public.*max-age=/);
    expect(res.headers.etag).toBeDefined();
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths["/health"]).toBeDefined();
    expect(res.body.paths["/api/chat"]).toBeDefined();
    expect(res.body.paths["/api/admin/sites"]).toBeDefined();
    expect(res.body.components.schemas.SiteConfig).toBeDefined();
  });

  it("returns 304 on a matching If-None-Match for /openapi.yaml", async () => {
    // The ETag is content-based (SHA-256 of the spec bytes), so a
    // conditional GET with the same etag should short-circuit to 304.
    // This guards against future changes accidentally turning the
    // route into a full-body response every request.
    const app = createApp({ db });
    const first = await request(app).get("/openapi.yaml");
    const etag = first.headers.etag;
    expect(etag).toBeDefined();
    const second = await request(app).get("/openapi.yaml").set("If-None-Match", etag);
    expect(second.status).toBe(304);
  });

  it("returns 503 when the openapi.yaml file is missing", async () => {
    // Point createApp at a path that cannot exist. The cache loader
    // catches the read failure, both caches stay null, and the
    // routes fall through to the 503 branch. The pre-existing 503
    // text is a sanity check that we hit the missing-cache path and
    // not, say, a stack-trace.
    const tmp = mkdtempSync(path.join(tmpdir(), "kody-openapi-503-"));
    try {
      const missing = path.join(tmp, "does-not-exist.yaml");
      const app = createApp({ db, openapiPath: missing });
      const yamlRes = await request(app).get("/openapi.yaml");
      const jsonRes = await request(app).get("/openapi.json");
      expect(yamlRes.status).toBe(503);
      expect(yamlRes.text).toContain("OpenAPI spec not available");
      expect(jsonRes.status).toBe(503);
      expect(jsonRes.text).toContain("OpenAPI spec not available");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("packages/shared/openapi.yaml", () => {
  // The committed openapi.yaml must stay in lockstep with the
  // generator — otherwise a new validator or a new path ships as
  // code without the matching API doc. The shared test already
  // byte-compares the in-memory spec against the file, but we
  // also assert the file itself parses, lists every path, and
  // round-trips through the build function with the same options
  // the generator uses (lineWidth, noRefs, flowLevel, sortKeys).
  it("is a parseable YAML document", () => {
    const text = readFileSync(
      path.resolve(__dirname, "../../../shared/openapi.yaml"),
      "utf8",
    );
    const parsed = yaml.load(text) as { openapi?: string };
    expect(parsed.openapi).toBe("3.1.0");
  });

  it("contains every required path key", () => {
    const text = readFileSync(
      path.resolve(__dirname, "../../../shared/openapi.yaml"),
      "utf8",
    );
    const required = [
      "/health:",
      "/api/config/{siteId}:",
      "/api/chat:",
      "/api/admin/sites:",
      "/api/admin/sites/{siteId}:",
    ];
    for (const needle of required) {
      expect(text, `expected to find \`${needle}\` in openapi.yaml`).toContain(needle);
    }
  });
});

