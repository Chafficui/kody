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

  getPublicConfig(siteId: string): PublicSiteConfig | null {
    const config = this.getSiteConfig(siteId);
    if (!config) return null;
    return toPublicConfig(config);
  }

  updateSite(siteId: string, rawConfig: unknown): SiteConfig {
    const config = siteConfigSchema.parse(rawConfig);

    const result = this.db
      .prepare(
        "UPDATE sites SET config = ?, enabled = ?, updated_at = datetime('now') WHERE site_id = ?",
      )
      .run(JSON.stringify(config), config.enabled ? 1 : 0, siteId);

    if (result.changes === 0) {
      throw new Error(`Site not found: ${siteId}`);
    }

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
