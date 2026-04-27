import { Router, type Router as RouterType } from "express";
import type { ScrapeStore } from "../../services/scrape-store.js";

export function createAdminScrapingRouter(scrapeStore: ScrapeStore): RouterType {
  const router: RouterType = Router({ mergeParams: true });

  router.get("/:siteId/scraping", (req, res) => {
    const results = scrapeStore.getResults(req.params.siteId);
    res.json(results);
  });

  router.post("/:siteId/scraping/:sourceIndex/rescrape", async (req, res) => {
    try {
      const sourceIndex = parseInt(req.params.sourceIndex, 10);
      if (isNaN(sourceIndex)) {
        res.status(400).json({ error: { message: "Invalid source index" } });
        return;
      }
      const result = await scrapeStore.rescrape(req.params.siteId, sourceIndex);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scrape failed";
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json({ error: { message } });
    }
  });

  return router;
}
