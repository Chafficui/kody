import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { SiteStore } from "../../src/services/site-store.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

const validConfig = {
  siteId: "test-site",
  allowedOrigins: ["https://example.com"],
  ai: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  guardrails: {
    allowedTopics: ["billing"],
    topicDescription: "Help with billing.",
  },
};

describe("SiteStore", () => {
  let db: Database.Database;
  let store: SiteStore;

  beforeEach(() => {
    db = createTestDb();
    store = new SiteStore(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("createSite", () => {
    it("creates a site and returns parsed config", () => {
      const site = store.createSite(validConfig);
      expect(site.siteId).toBe("test-site");
      expect(site.branding.name).toBe("Assistant");
      expect(site.enabled).toBe(true);
    });

    it("rejects duplicate siteId", () => {
      store.createSite(validConfig);
      expect(() => store.createSite(validConfig)).toThrow();
    });

    it("validates config against schema", () => {
      expect(() => store.createSite({ siteId: "bad" } as never)).toThrow();
    });
  });

  describe("getSiteConfig", () => {
    it("returns config for existing site", () => {
      store.createSite(validConfig);
      const site = store.getSiteConfig("test-site");
      expect(site).toBeDefined();
      expect(site!.siteId).toBe("test-site");
    });

    it("returns null for nonexistent site", () => {
      const site = store.getSiteConfig("nonexistent");
      expect(site).toBeNull();
    });

    it("returns null for disabled site", () => {
      store.createSite(validConfig);
      store.updateSite("test-site", { ...validConfig, enabled: false });
      const site = store.getSiteConfig("test-site");
      expect(site).toBeNull();
    });
  });

  describe("getPublicConfig", () => {
    it("returns only public fields", () => {
      store.createSite(validConfig);
      const pub = store.getPublicConfig("test-site");
      expect(pub).toBeDefined();
      expect(pub!.siteId).toBe("test-site");
      expect(pub!.branding.name).toBe("Assistant");
      expect((pub as Record<string, unknown>)["ai"]).toBeUndefined();
      expect((pub as Record<string, unknown>)["guardrails"]).toBeUndefined();
    });

    it("returns null for nonexistent site", () => {
      const pub = store.getPublicConfig("nonexistent");
      expect(pub).toBeNull();
    });
  });

  describe("updateSite", () => {
    it("updates an existing site", () => {
      store.createSite(validConfig);
      const updated = store.updateSite("test-site", {
        ...validConfig,
        branding: { name: "NewBot" },
      });
      expect(updated.branding.name).toBe("NewBot");
    });

    it("throws for nonexistent site", () => {
      expect(() => store.updateSite("nonexistent", validConfig)).toThrow();
    });
  });

  describe("deleteSite", () => {
    it("deletes an existing site", () => {
      store.createSite(validConfig);
      const deleted = store.deleteSite("test-site");
      expect(deleted).toBe(true);
      expect(store.getSiteConfig("test-site")).toBeNull();
    });

    it("returns false for nonexistent site", () => {
      const deleted = store.deleteSite("nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("listSites", () => {
    it("returns all sites", () => {
      store.createSite(validConfig);
      store.createSite({
        ...validConfig,
        siteId: "second-site",
        allowedOrigins: ["https://second.com"],
      });
      const sites = store.listSites();
      expect(sites).toHaveLength(2);
    });

    it("returns empty array when no sites", () => {
      const sites = store.listSites();
      expect(sites).toHaveLength(0);
    });
  });

  describe("cache", () => {
    it("serves from cache on second read", () => {
      store.createSite(validConfig);
      const first = store.getSiteConfig("test-site");
      const second = store.getSiteConfig("test-site");
      expect(first).toEqual(second);
    });

    it("invalidates cache on update", () => {
      store.createSite(validConfig);
      store.getSiteConfig("test-site");
      store.updateSite("test-site", {
        ...validConfig,
        branding: { name: "Updated" },
      });
      const after = store.getSiteConfig("test-site");
      expect(after!.branding.name).toBe("Updated");
    });

    it("invalidates cache on delete", () => {
      store.createSite(validConfig);
      store.getSiteConfig("test-site");
      store.deleteSite("test-site");
      expect(store.getSiteConfig("test-site")).toBeNull();
    });
  });
});
