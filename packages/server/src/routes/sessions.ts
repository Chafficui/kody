import { Router, type Router as RouterType } from "express";
import type { ConversationStore } from "../services/conversation-store.js";

export function createSessionsRouter(conversationStore: ConversationStore): RouterType {
  const router: RouterType = Router();

  router.delete("/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    conversationStore.delete(sessionId);
    res.status(204).end();
  });

  return router;
}
