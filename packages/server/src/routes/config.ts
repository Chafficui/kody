import { Router, type Router as RouterType } from "express";
import type { SiteStore } from "../services/site-store.js";

export function createConfigRouter(siteStore: SiteStore): RouterType {
  const router: RouterType = Router();

  router.get("/:siteId", (req, res) => {
    const { siteId } = req.params;
    const publicConfig = siteStore.getPublicConfig(siteId);

    if (!publicConfig) {
      res.status(404).json({ error: { message: "Site not found" } });
      return;
    }

    res.json(publicConfig);
  });

  return router;
}
