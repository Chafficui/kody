import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../../src/db/migrate.js";
import { createApp } from "../../../src/app.js";

describe("Admin Users API", () => {
  let db: Database.Database;
  let token: string;

  beforeEach(async () => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);

    const app = createApp({ db });
    await app.authService.createUser("admin@test.com", "password123");
    const loginRes = await request(app).post("/api/admin/login").send({
      email: "admin@test.com",
      password: "password123",
    });
    token = loginRes.body.token;
  });

  afterEach(() => {
    db.close();
  });

  function makeApp() {
    return createApp({ db });
  }

  describe("GET /api/admin/users", () => {
    it("returns 401 without auth", async () => {
      const res = await request(makeApp()).get("/api/admin/users");
      expect(res.status).toBe(401);
    });

    it("lists users when authenticated", async () => {
      const res = await request(makeApp())
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe("admin@test.com");
    });
  });

  describe("POST /api/admin/users", () => {
    it("creates a new user", async () => {
      const res = await request(makeApp())
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "newuser@test.com", password: "newpassword1" });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe("newuser@test.com");
      expect(res.body.id).toBeDefined();
    });

    it("returns 400 for invalid email", async () => {
      const res = await request(makeApp())
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "bad-email", password: "password123" });

      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate email", async () => {
      const res = await request(makeApp())
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "admin@test.com", password: "password123" });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("Email already exists");
    });
  });

  describe("DELETE /api/admin/users/:userId", () => {
    it("deletes another user", async () => {
      const app = makeApp();
      const createRes = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "other@test.com", password: "otherpass12" });

      const userId = createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const listRes = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${token}`);

      expect(listRes.body).toHaveLength(1);
    });

    it("prevents self-deletion", async () => {
      const app = makeApp();
      const listRes = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${token}`);

      const myId = listRes.body.find((u: { email: string }) => u.email === "admin@test.com").id;

      const deleteRes = await request(app)
        .delete(`/api/admin/users/${myId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(deleteRes.status).toBe(400);
      expect(deleteRes.body.error.message).toBe("Cannot delete your own account");
    });

    it("returns 404 for nonexistent user", async () => {
      const res = await request(makeApp())
        .delete("/api/admin/users/9999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid user ID", async () => {
      const res = await request(makeApp())
        .delete("/api/admin/users/abc")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});
