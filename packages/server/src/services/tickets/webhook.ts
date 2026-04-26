import { createHmac } from "node:crypto";
import type { TicketData, TicketProvider, TicketResult } from "./types.js";

export interface WebhookConfig {
  provider: "webhook";
  url: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
  secret?: string;
}

export class WebhookProvider implements TicketProvider {
  constructor(private config: WebhookConfig) {}

  async createTicket(data: TicketData): Promise<TicketResult> {
    const body = JSON.stringify({
      siteId: data.siteId,
      fields: data.fields,
      transcript: data.transcript,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };

    if (this.config.secret) {
      const signature = createHmac("sha256", this.config.secret).update(body).digest("hex");
      headers["X-Kody-Signature"] = signature;
    }

    const response = await fetch(this.config.url, {
      method: this.config.method,
      headers,
      body,
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Webhook failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      message: "Ticket submitted via webhook",
    };
  }
}
