import { Router, type Router as RouterType } from "express";
import { siteConfigSchema, redactSiteConfigForRead } from "@kody/shared";
import type { SiteStore } from "../../services/site-store.js";

export function createAdminSitesRouter(siteStore: SiteStore): RouterType {
  const router: RouterType = Router();

  // Every GET response strips secret-bearing fields. The create / update
  // paths intentionally echo the parsed config back so callers can
  // confirm what was stored (including the secret they just set), so
  // those endpoints stay untouched.
  router.get("/", (_req, res) => {
    const sites = siteStore.listSites().map(redactSiteConfigForRead);
    res.json(sites);
  });

  router.get("/:siteId", (req, res) => {
    const config = siteStore.getSiteConfig(req.params.siteId);
    if (!config) {
      // Also check disabled sites for admin
      const all = siteStore.listSites();
      const found = all.find((s) => s.siteId === req.params.siteId);
      if (found) {
        res.json(redactSiteConfigForRead(found));
        return;
      }
      res.status(404).json({ error: { message: "Site not found" } });
      return;
    }
    res.json(redactSiteConfigForRead(config));
  });

  router.post("/", (req, res) => {
    try {
      const site = siteStore.createSite(req.body);
      res.status(201).json(site);
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        res.status(409).json({ error: { message: "Site ID already exists" } });
        return;
      }
      const message = err instanceof Error ? err.message : "Invalid site configuration";
      res.status(400).json({ error: { message } });
    }
  });

  router.put("/:siteId", (req, res) => {
    try {
      const site = siteStore.updateSite(req.params.siteId, req.body);
      res.json(site);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid site configuration";
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json({ error: { message } });
    }
  });

  router.delete("/:siteId", (req, res) => {
    const deleted = siteStore.deleteSite(req.params.siteId);
    if (!deleted) {
      res.status(404).json({ error: { message: "Site not found" } });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
