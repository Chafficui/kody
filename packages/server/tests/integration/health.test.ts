import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { createApp } from "../../src/app.js";

describe("GET /health", () => {
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

  it("returns 200 with status ok", async () => {
    const app = createApp({ db });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });

  it("returns a valid ISO timestamp", async () => {
    const app = createApp({ db });
    const res = await request(app).get("/health");
    const date = new Date(res.body.timestamp);
    expect(date.toISOString()).toBe(res.body.timestamp);
  });
});

describe("unknown routes", () => {
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

  it("returns 404 for unknown routes", async () => {
    const app = createApp({ db });
    const res = await request(app).get("/nonexistent");
    expect(res.status).toBe(404);
  });
});
