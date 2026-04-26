import { Router, type Router as RouterType } from "express";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export function createWidgetRouter(): RouterType {
  const router: RouterType = Router();

  const widgetPath = resolve(import.meta.dirname, "../../../widget/dist/kody.js");
  const isDev = process.env.NODE_ENV !== "production";

  let cachedScript: string | null = null;

  router.get("/", (_req, res) => {
    if (!cachedScript || isDev) {
      if (!existsSync(widgetPath)) {
        res.status(404).send("// Widget not built. Run: pnpm --filter @kody/widget build");
        return;
      }
      cachedScript = readFileSync(widgetPath, "utf-8");
    }

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", isDev ? "no-cache" : "public, max-age=3600");
    res.send(cachedScript);
  });

  return router;
}
