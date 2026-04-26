export interface TicketData {
  fields: { name?: string; email?: string; subject?: string; description: string };
  transcript?: string;
  siteId: string;
}

export interface TicketResult {
  success: boolean;
  ticketId?: string;
  ticketUrl?: string;
  message: string;
}

export interface TicketProvider {
  createTicket(data: TicketData): Promise<TicketResult>;
}
