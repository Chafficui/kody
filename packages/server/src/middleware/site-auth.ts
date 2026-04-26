import type { Request, Response, NextFunction } from "express";
import type { SiteStore } from "../services/site-store.js";
import type { SiteConfig } from "@kody/shared";

declare global {
  namespace Express {
    interface Request {
      siteConfig?: SiteConfig;
    }
  }
}

export function createSiteAuth(siteStore: SiteStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const siteId = req.headers["x-kody-site-id"] as string | undefined;

    if (!siteId) {
      res.status(400).json({ error: { message: "Missing x-kody-site-id header" } });
      return;
    }

    const config = siteStore.getSiteConfig(siteId);
    if (!config) {
      res.status(404).json({ error: { message: "Site not found" } });
      return;
    }

    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      const originUrl = new URL(origin).origin;
      const allowed = config.allowedOrigins.some((ao) => {
        try {
          return new URL(ao).origin === originUrl;
        } catch {
          return false;
        }
      });

      if (!allowed) {
        res.status(403).json({ error: { message: "Origin not allowed" } });
        return;
      }
    }

    req.siteConfig = config;
    next();
  };
}
