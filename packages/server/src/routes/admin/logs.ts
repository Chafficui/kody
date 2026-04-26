import { Router, type Router as RouterType } from "express";
import { logStore } from "../../services/log-store.js";

export function createAdminLogsRouter(): RouterType {
  const router: RouterType = Router();

  router.get("/", (req, res) => {
    const level = typeof req.query.level === "string" ? req.query.level : undefined;
    const since = typeof req.query.since === "string" ? parseInt(req.query.since, 10) : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;

    const entries = logStore.getEntries({ level, since, limit });
    res.json({ entries });
  });

  router.delete("/", (_req, res) => {
    logStore.clear();
    res.json({ success: true });
  });

  return router;
}
