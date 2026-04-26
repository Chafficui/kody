import { describe, it, expect } from "vitest";
import { ticketRequestSchema, ticketResultSchema } from "../src/validators/ticket.js";

describe("ticketRequestSchema", () => {
  it("accepts a valid request with all fields", () => {
    const result = ticketRequestSchema.parse({
      siteId: "my-site",
      sessionId: "sess-123",
      fields: {
        name: "John Doe",
        email: "john@example.com",
        subject: "Bug report",
        description: "Something is broken",
      },
      includeTranscript: true,
    });
    expect(result.fields.name).toBe("John Doe");
    expect(result.includeTranscript).toBe(true);
  });

  it("accepts a minimal request with only required fields", () => {
    const result = ticketRequestSchema.parse({
      siteId: "my-site",
      sessionId: "sess-123",
      fields: {
        description: "Something is broken",
      },
    });
    expect(result.fields.name).toBeUndefined();
    expect(result.fields.email).toBeUndefined();
    expect(result.includeTranscript).toBe(true);
  });

  it("rejects missing description", () => {
    expect(() =>
      ticketRequestSchema.parse({
        siteId: "my-site",
        sessionId: "sess-123",
        fields: { name: "John" },
      }),
    ).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      ticketRequestSchema.parse({
        siteId: "my-site",
        sessionId: "sess-123",
        fields: { email: "not-an-email", description: "Test" },
      }),
    ).toThrow();
  });

  it("rejects missing siteId", () => {
    expect(() =>
      ticketRequestSchema.parse({
        sessionId: "sess-123",
        fields: { description: "Test" },
      }),
    ).toThrow();
  });
});

describe("ticketResultSchema", () => {
  it("accepts a successful result with URL", () => {
    const result = ticketResultSchema.parse({
      success: true,
      ticketId: "TICKET-123",
      ticketUrl: "https://jira.example.com/browse/TICKET-123",
      message: "Ticket created successfully",
    });
    expect(result.success).toBe(true);
    expect(result.ticketUrl).toContain("TICKET-123");
  });

  it("accepts a failed result without URL", () => {
    const result = ticketResultSchema.parse({
      success: false,
      message: "Failed to create ticket",
    });
    expect(result.success).toBe(false);
    expect(result.ticketId).toBeUndefined();
  });
});
