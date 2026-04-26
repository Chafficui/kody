import { describe, it, expect, vi } from "vitest";
import { EmailProvider } from "../../../src/services/tickets/email.js";
import type { TicketData } from "../../../src/services/tickets/types.js";

const config = {
  provider: "email" as const,
  to: "support@acme.com",
};

const ticketData: TicketData = {
  siteId: "site-1",
  fields: {
    name: "Alice",
    email: "alice@example.com",
    subject: "Cannot login",
    description: "I keep getting a 403 error.",
  },
};

describe("EmailProvider", () => {
  it("returns success with the correct message", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const provider = new EmailProvider(config);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Ticket emailed to support@acme.com");

    consoleSpy.mockRestore();
  });

  it("logs ticket details", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const provider = new EmailProvider(config);
    await provider.createTicket(ticketData);

    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("support@acme.com");

    consoleSpy.mockRestore();
  });
});
