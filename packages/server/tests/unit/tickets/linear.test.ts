import { describe, it, expect, beforeEach, vi } from "vitest";
import { LinearProvider } from "../../../src/services/tickets/linear.js";
import type { TicketData } from "../../../src/services/tickets/types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const config = {
  provider: "linear" as const,
  apiKey: "lin_api_test-key",
  teamId: "team-abc",
  labelIds: ["label-1", "label-2"],
};

const ticketData: TicketData = {
  siteId: "site-1",
  fields: {
    name: "Alice",
    email: "alice@example.com",
    subject: "Cannot login",
    description: "I keep getting a 403 error when logging in.",
  },
  transcript: "User: I cannot login\nAssistant: Let me help.",
};

describe("LinearProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("creates an issue with correct GraphQL query and auth", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          issueCreate: {
            success: true,
            issue: {
              id: "issue-id-1",
              identifier: "TEAM-42",
              url: "https://linear.app/acme/issue/TEAM-42",
            },
          },
        },
      }),
    });

    const provider = new LinearProvider(config);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(true);
    expect(result.ticketId).toBe("TEAM-42");
    expect(result.ticketUrl).toBe("https://linear.app/acme/issue/TEAM-42");
    expect(result.message).toBe("Linear issue created");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.linear.app/graphql");
    expect(options.headers.Authorization).toBe("lin_api_test-key");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.query).toContain("issueCreate");
    expect(body.variables.input.teamId).toBe("team-abc");
    expect(body.variables.input.title).toBe("Cannot login");
    expect(body.variables.input.labelIds).toEqual(["label-1", "label-2"]);
    expect(body.variables.input.description).toContain("403 error");
  });

  it("uses fallback title when no subject", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          issueCreate: {
            success: true,
            issue: { id: "x", identifier: "TEAM-1", url: "https://linear.app/acme/issue/TEAM-1" },
          },
        },
      }),
    });

    const data: TicketData = {
      siteId: "site-1",
      fields: { email: "bob@example.com", description: "Help" },
    };

    const provider = new LinearProvider(config);
    await provider.createTicket(data);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.input.title).toBe("Support ticket from bob@example.com");
  });

  it("returns failure on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const provider = new LinearProvider(config);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("401");
  });

  it("returns failure on GraphQL error", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [{ message: "Team not found" }],
      }),
    });

    const provider = new LinearProvider(config);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Team not found");
  });
});
