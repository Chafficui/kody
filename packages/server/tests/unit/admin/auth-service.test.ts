import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../../../src/db/migrate.js";
import { AdminAuthService } from "../../../src/services/admin/auth-service.js";

describe("AdminAuthService", () => {
  let db: Database.Database;
  let auth: AdminAuthService;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    auth = new AdminAuthService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("createUser", () => {
    it("creates a user and returns id + email", async () => {
      const user = await auth.createUser("admin@example.com", "securepass123");
      expect(user.id).toBeDefined();
      expect(user.email).toBe("admin@example.com");
    });

    it("hashes the password (not stored in plain text)", async () => {
      await auth.createUser("admin@example.com", "securepass123");
      const row = db
        .prepare("SELECT password_hash FROM admin_users WHERE email = ?")
        .get("admin@example.com") as { password_hash: string };
      expect(row.password_hash).not.toBe("securepass123");
      expect(row.password_hash.length).toBeGreaterThan(20);
    });

    it("rejects duplicate email", async () => {
      await auth.createUser("admin@example.com", "securepass123");
      await expect(auth.createUser("admin@example.com", "otherpass123")).rejects.toThrow();
    });
  });

  describe("login", () => {
    it("returns a session token for valid credentials", async () => {
      await auth.createUser("admin@example.com", "securepass123");
      const session = await auth.login("admin@example.com", "securepass123");
      expect(session).not.toBeNull();
      expect(session!.token).toBeDefined();
      expect(session!.token.length).toBeGreaterThan(20);
      expect(session!.userId).toBeDefined();
    });

    it("returns null for wrong password", async () => {
      await auth.createUser("admin@example.com", "securepass123");
      const session = await auth.login("admin@example.com", "wrongpassword");
      expect(session).toBeNull();
    });

    it("returns null for nonexistent user", async () => {
      const session = await auth.login("nobody@example.com", "password123");
      expect(session).toBeNull();
    });
  });

  describe("validateSession", () => {
    it("returns user for valid session token", async () => {
      await auth.createUser("admin@example.com", "securepass123");
      const session = await auth.login("admin@example.com", "securepass123");
      const user = auth.validateSession(session!.token);
      expect(user).not.toBeNull();
      expect(user!.email).toBe("admin@example.com");
    });

    it("returns null for invalid token", () => {
      const user = auth.validateSession("invalid-token");
      expect(user).toBeNull();
    });

    it("returns null for expired session", async () => {
      await auth.createUser("admin@example.com", "securepass123");
      const session = await auth.login("admin@example.com", "securepass123");

      db.prepare(
        "UPDATE admin_sessions SET expires_at = datetime('now', '-1 hour') WHERE token = ?",
      ).run(session!.token);

      const user = auth.validateSession(session!.token);
      expect(user).toBeNull();
    });
  });

  describe("logout", () => {
    it("invalidates the session token", async () => {
      await auth.createUser("admin@example.com", "securepass123");
      const session = await auth.login("admin@example.com", "securepass123");
      auth.logout(session!.token);
      const user = auth.validateSession(session!.token);
      expect(user).toBeNull();
    });

    it("does not throw for invalid token", () => {
      expect(() => auth.logout("nonexistent")).not.toThrow();
    });
  });

  describe("listUsers", () => {
    it("returns all admin users", async () => {
      await auth.createUser("admin1@example.com", "password1234");
      await auth.createUser("admin2@example.com", "password5678");
      const users = auth.listUsers();
      expect(users).toHaveLength(2);
      expect(users[0]!.email).toBeDefined();
      expect((users[0] as Record<string, unknown>)["password_hash"]).toBeUndefined();
    });

    it("returns empty array when no users", () => {
      const users = auth.listUsers();
      expect(users).toHaveLength(0);
    });
  });

  describe("deleteUser", () => {
    it("deletes a user", async () => {
      const user = await auth.createUser("admin@example.com", "securepass123");
      const deleted = auth.deleteUser(user.id);
      expect(deleted).toBe(true);
      expect(auth.listUsers()).toHaveLength(0);
    });

    it("returns false for nonexistent user", () => {
      const deleted = auth.deleteUser(999);
      expect(deleted).toBe(false);
    });

    it("cascades deletion to sessions", async () => {
      const user = await auth.createUser("admin@example.com", "securepass123");
      const session = await auth.login("admin@example.com", "securepass123");
      auth.deleteUser(user.id);
      const valid = auth.validateSession(session!.token);
      expect(valid).toBeNull();
    });
  });

  describe("ensureAdminExists", () => {
    it("creates admin if none exist", async () => {
      const created = await auth.ensureAdminExists("boot@example.com", "bootpassword1");
      expect(created).toBe(true);
      expect(auth.listUsers()).toHaveLength(1);
    });

    it("does nothing if admin already exists", async () => {
      await auth.createUser("existing@example.com", "password1234");
      const created = await auth.ensureAdminExists("boot@example.com", "bootpassword1");
      expect(created).toBe(false);
      expect(auth.listUsers()).toHaveLength(1);
      expect(auth.listUsers()[0]!.email).toBe("existing@example.com");
    });
  });
});
