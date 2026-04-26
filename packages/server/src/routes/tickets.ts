import { Router, type Router as RouterType } from "express";
import { ticketRequestSchema } from "@kody/shared";
import type { ConversationStore } from "../services/conversation-store.js";
import { createTicketProvider, type TicketProviderConfig } from "../services/tickets/index.js";

export function createTicketsRouter(conversationStore: ConversationStore): RouterType {
  const router: RouterType = Router();

  router.post("/", async (req, res) => {
    const config = req.siteConfig;
    if (!config) {
      res.status(400).json({ error: { message: "Missing site config" } });
      return;
    }

    if (!config.tickets.enabled || config.tickets.providers.length === 0) {
      res.status(400).json({ error: { message: "Tickets are not enabled for this site" } });
      return;
    }

    const parsed = ticketRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request", details: parsed.error.issues } });
      return;
    }

    const { fields, sessionId, includeTranscript } = parsed.data;

    let transcript: string | undefined;
    if (includeTranscript && sessionId) {
      const messages = conversationStore.getTranscript(sessionId);
      if (messages.length > 0) {
        transcript = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
      }
    }

    const providerConfig = config.tickets.providers[0] as TicketProviderConfig;
    const provider = createTicketProvider(providerConfig);

    try {
      const result = await provider.createTicket({
        fields,
        transcript,
        siteId: config.siteId,
      });
      res.json(result);
    } catch {
      res.status(500).json({
        success: false,
        message: "Failed to create ticket. Please try again later.",
      });
    }
  });

  return router;
}
