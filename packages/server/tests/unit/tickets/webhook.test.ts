import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebhookProvider } from "../../../src/services/tickets/webhook.js";
import type { TicketData } from "../../../src/services/tickets/types.js";
import { createHmac } from "node:crypto";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const baseConfig = {
  provider: "webhook" as const,
  url: "https://hooks.example.com/tickets",
  method: "POST" as const,
  headers: { "X-Custom": "test-value" },
};

const ticketData: TicketData = {
  siteId: "site-1",
  fields: {
    name: "Alice",
    email: "alice@example.com",
    subject: "Cannot login",
    description: "I keep getting a 403 error when logging in.",
  },
  transcript: "User: I cannot login\nAssistant: Let me create a ticket for you.",
};

describe("WebhookProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends correct URL, method, headers, and body", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const provider = new WebhookProvider(baseConfig);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Ticket submitted via webhook");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/tickets");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-Custom"]).toBe("test-value");

    const body = JSON.parse(options.body);
    expect(body.siteId).toBe("site-1");
    expect(body.fields.name).toBe("Alice");
    expect(body.transcript).toContain("I cannot login");
  });

  it("includes HMAC signature when secret is set", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const config = { ...baseConfig, secret: "my-secret-key" };
    const provider = new WebhookProvider(config);
    await provider.createTicket(ticketData);

    const [, options] = mockFetch.mock.calls[0];
    const expectedSig = createHmac("sha256", "my-secret-key").update(options.body).digest("hex");

    expect(options.headers["X-Kody-Signature"]).toBe(expectedSig);
  });

  it("does not include signature header when no secret", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const provider = new WebhookProvider(baseConfig);
    await provider.createTicket(ticketData);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Kody-Signature"]).toBeUndefined();
  });

  it("returns failure for non-2xx response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const provider = new WebhookProvider(baseConfig);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("500");
  });

  it("uses PUT method when configured", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const config = { ...baseConfig, method: "PUT" as const };
    const provider = new WebhookProvider(config);
    await provider.createTicket(ticketData);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("PUT");
  });
});
