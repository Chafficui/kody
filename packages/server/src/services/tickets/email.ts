import type { TicketData, TicketProvider, TicketResult } from "./types.js";

export interface EmailConfig {
  provider: "email";
  to: string;
  from?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}

export class EmailProvider implements TicketProvider {
  constructor(private config: EmailConfig) {}

  // TODO: Implement real SMTP sending. For now, this is a stub that logs the ticket.
  async createTicket(data: TicketData): Promise<TicketResult> {
    console.log(
      `[EmailProvider] Would send ticket to ${this.config.to}:`,
      JSON.stringify({ siteId: data.siteId, fields: data.fields }, null, 2),
    );

    return {
      success: true,
      message: `Ticket emailed to ${this.config.to}`,
    };
  }
}
