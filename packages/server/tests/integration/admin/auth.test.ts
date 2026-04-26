import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../../src/db/migrate.js";
import { createApp } from "../../../src/app.js";

describe("Admin Auth API", () => {
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

  describe("POST /api/admin/login", () => {
    it("returns 200 with token for valid credentials", async () => {
      const app = createApp({ db });
      await app.authService.createUser("admin@test.com", "password123");

      const res = await request(app).post("/api/admin/login").send({
        email: "admin@test.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.expiresAt).toBeDefined();
    });

    it("sets httpOnly session cookie", async () => {
      const app = createApp({ db });
      await app.authService.createUser("admin@test.com", "password123");

      const res = await request(app).post("/api/admin/login").send({
        email: "admin@test.com",
        password: "password123",
      });

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const sessionCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.includes("kody_session"))
        : cookies;
      expect(sessionCookie).toContain("HttpOnly");
      expect(sessionCookie).toContain("SameSite=Strict");
    });

    it("returns 401 for wrong password", async () => {
      const app = createApp({ db });
      await app.authService.createUser("admin@test.com", "password123");

      const res = await request(app).post("/api/admin/login").send({
        email: "admin@test.com",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Invalid email or password");
    });

    it("returns 401 for nonexistent email", async () => {
      const app = createApp({ db });
      const res = await request(app).post("/api/admin/login").send({
        email: "nobody@test.com",
        password: "password123",
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid request body", async () => {
      const app = createApp({ db });
      const res = await request(app).post("/api/admin/login").send({
        email: "not-an-email",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Invalid request");
    });
  });

  describe("POST /api/admin/logout", () => {
    it("invalidates session and clears cookie", async () => {
      const app = createApp({ db });
      await app.authService.createUser("admin@test.com", "password123");

      const loginRes = await request(app).post("/api/admin/login").send({
        email: "admin@test.com",
        password: "password123",
      });

      const token = loginRes.body.token;

      const logoutRes = await request(app)
        .post("/api/admin/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      const protectedRes = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${token}`);

      expect(protectedRes.status).toBe(401);
    });
  });
});
