import { Router, type Router as RouterType } from "express";

export const healthRouter: RouterType = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
