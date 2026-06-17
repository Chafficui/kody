import { Router, type Router as RouterType } from "express";
import type Database from "better-sqlite3";
import { feedbackRequestSchema } from "@kody/shared";

export function createFeedbackRouter(db: Database.Database): RouterType {
  const router: RouterType = Router();

  router.post("/", (req, res) => {
    const parsed = feedbackRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request", details: parsed.error.issues } });
      return;
    }

    const { siteId, sessionId, messageIndex, rating } = parsed.data;

    db.prepare(
      "INSERT INTO feedback (site_id, session_id, message_index, rating) VALUES (?, ?, ?, ?)",
    ).run(siteId, sessionId, messageIndex, rating);

    res.status(201).json({ ok: true });
  });

  return router;
}
