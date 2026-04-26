import Database from "better-sqlite3";
import { migrate } from "./migrate.js";

let db: Database.Database | null = null;

export function getDb(dbPath: string = "./kody.db"): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function createTestDb(): Database.Database {
  const testDb = new Database(":memory:");
  testDb.pragma("journal_mode = WAL");
  testDb.pragma("foreign_keys = ON");
  migrate(testDb);
  return testDb;
}
