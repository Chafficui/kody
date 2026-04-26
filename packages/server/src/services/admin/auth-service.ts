import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import argon2 from "argon2";

interface AdminUser {
  id: number;
  email: string;
  createdAt: string;
}

interface AdminSession {
  token: string;
  userId: number;
  expiresAt: string;
}

const SESSION_DURATION_HOURS = 24;

export class AdminAuthService {
  constructor(private db: Database.Database) {}

  async createUser(email: string, password: string): Promise<AdminUser> {
    const hash = await argon2.hash(password);
    const result = this.db
      .prepare("INSERT INTO admin_users (email, password_hash) VALUES (?, ?)")
      .run(email, hash);

    return {
      id: result.lastInsertRowid as number,
      email,
      createdAt: new Date().toISOString(),
    };
  }

  async login(email: string, password: string): Promise<AdminSession | null> {
    const row = this.db
      .prepare("SELECT id, password_hash FROM admin_users WHERE email = ?")
      .get(email) as { id: number; password_hash: string } | undefined;

    if (!row) return null;

    const valid = await argon2.verify(row.password_hash, password);
    if (!valid) return null;

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600_000).toISOString();

    this.db
      .prepare("INSERT INTO admin_sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .run(row.id, token, expiresAt);

    return { token, userId: row.id, expiresAt };
  }

  validateSession(token: string): AdminUser | null {
    const row = this.db
      .prepare(
        `SELECT u.id, u.email, u.created_at as createdAt
         FROM admin_sessions s
         JOIN admin_users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now')`,
      )
      .get(token) as { id: number; email: string; createdAt: string } | undefined;

    if (!row) return null;
    return { id: row.id, email: row.email, createdAt: row.createdAt };
  }

  logout(token: string): void {
    this.db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
  }

  listUsers(): AdminUser[] {
    return this.db
      .prepare(
        "SELECT id, email, created_at as createdAt FROM admin_users ORDER BY created_at DESC",
      )
      .all() as AdminUser[];
  }

  deleteUser(userId: number): boolean {
    const result = this.db.prepare("DELETE FROM admin_users WHERE id = ?").run(userId);
    return result.changes > 0;
  }

  async ensureAdminExists(email: string, password: string): Promise<boolean> {
    const count = this.db.prepare("SELECT COUNT(*) as cnt FROM admin_users").get() as {
      cnt: number;
    };
    if (count.cnt > 0) return false;
    await this.createUser(email, password);
    return true;
  }
}
