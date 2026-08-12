import type Database from "better-sqlite3";
import {
  siteConfigSchema,
  toPublicConfig,
  type SiteConfig,
  type PublicSiteConfig,
} from "@kody/shared";

export class SiteStore {
  private cache = new Map<string, SiteConfig>();

  constructor(private db: Database.Database) {}

  createSite(rawConfig: unknown): SiteConfig {
    const config = siteConfigSchema.parse(rawConfig);

    this.db
      .prepare("INSERT INTO sites (site_id, config, enabled) VALUES (?, ?, ?)")
      .run(config.siteId, JSON.stringify(config), config.enabled ? 1 : 0);

    this.cache.set(config.siteId, config);
    return config;
  }

  getSiteConfig(siteId: string): SiteConfig | null {
    const cached = this.cache.get(siteId);
    if (cached) {
      return cached.enabled ? cached : null;
    }

    const row = this.db
      .prepare("SELECT config FROM sites WHERE site_id = ? AND enabled = 1")
      .get(siteId) as { config: string } | undefined;

    if (!row) return null;

    const config = siteConfigSchema.parse(JSON.parse(row.config));
    this.cache.set(siteId, config);
    return config;
  }

  /**
   * Return `true` when any row exists for `siteId`, regardless of its
   * `enabled` flag. This is the raw existence check that
   * {@link getSiteConfig} hides — that method intentionally filters
   * disabled sites to keep runtime callers from serving them. Code
   * that needs to tell "site absent" from "site present but disabled"
   * (e.g. the demo-site seeder reconciling cold-start state) calls
   * this method instead.
   */
  hasSiteRecord(siteId: string): boolean {
    if (this.cache.has(siteId)) return true;

    const row = this.db
      .prepare("SELECT 1 FROM sites WHERE site_id = ?")
      .get(siteId) as { "1": number } | undefined;
    return row !== undefined;
  }

  getPublicConfig(siteId: string): PublicSiteConfig | null {
    const config = this.getSiteConfig(siteId);
    if (!config) return null;
    return toPublicConfig(config);
  }

  updateSite(siteId: string, rawConfig: unknown): SiteConfig {
    const row = this.db
      .prepare("SELECT config FROM sites WHERE site_id = ?")
      .get(siteId) as { config: string } | undefined;

    if (!row) {
      throw new Error(`Site not found: ${siteId}`);
    }

    const existing = JSON.parse(row.config);
    const merged = { ...existing, ...(rawConfig as Record<string, unknown>) };
    const config = siteConfigSchema.parse(merged);

    this.db
      .prepare(
        "UPDATE sites SET config = ?, enabled = ?, updated_at = datetime('now') WHERE site_id = ?",
      )
      .run(JSON.stringify(config), config.enabled ? 1 : 0, siteId);

    this.cache.set(siteId, config);
    return config;
  }

  deleteSite(siteId: string): boolean {
    const result = this.db.prepare("DELETE FROM sites WHERE site_id = ?").run(siteId);
    this.cache.delete(siteId);
    return result.changes > 0;
  }

  listSites(): SiteConfig[] {
    const rows = this.db.prepare("SELECT config FROM sites ORDER BY created_at DESC").all() as {
      config: string;
    }[];

    return rows.map((row) => siteConfigSchema.parse(JSON.parse(row.config)));
  }

}
