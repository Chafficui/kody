import { Router, type Router as RouterType } from "express";
import { siteConfigSchema, redactConfigSecrets } from "@kody/shared";
import type { SiteStore } from "../../services/site-store.js";

export function createAdminSitesRouter(siteStore: SiteStore): RouterType {
  const router: RouterType = Router();

  router.get("/", (_req, res) => {
    const sites = siteStore.listSites().map(redactConfigSecrets);
    res.json(sites);
  });

  router.get("/:siteId", (req, res) => {
    const config = siteStore.getSiteConfig(req.params.siteId);
    if (!config) {
      // Also check disabled sites for admin
      const all = siteStore.listSites();
      const found = all.find((s) => s.siteId === req.params.siteId);
      if (found) {
        res.json(redactConfigSecrets(found));
        return;
      }
      res.status(404).json({ error: { message: "Site not found" } });
      return;
    }
    res.json(redactConfigSecrets(config));
  });

  router.post("/", (req, res) => {
    try {
      const site = siteStore.createSite(req.body);
      // Echo a redacted view of the created site; the in-memory store
      // still holds the unredacted secret, ready for the next update.
      res.status(201).json(redactConfigSecrets(site));
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
      res.json(redactConfigSecrets(site));
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
