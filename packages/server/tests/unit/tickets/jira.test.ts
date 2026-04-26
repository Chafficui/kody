import { describe, it, expect, beforeEach, vi } from "vitest";
import { JiraProvider } from "../../../src/services/tickets/jira.js";
import type { TicketData } from "../../../src/services/tickets/types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const config = {
  provider: "jira" as const,
  baseUrl: "https://acme.atlassian.net",
  projectKey: "SUP",
  apiToken: "jira-api-token",
  email: "bot@acme.com",
  issueType: "Task",
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

describe("JiraProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("creates an issue with correct URL, basic auth, and body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        key: "SUP-123",
        self: "https://acme.atlassian.net/rest/api/2/issue/10001",
      }),
    });

    const provider = new JiraProvider(config);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(true);
    expect(result.ticketId).toBe("SUP-123");
    expect(result.ticketUrl).toBe("https://acme.atlassian.net/browse/SUP-123");
    expect(result.message).toBe("Jira issue created");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://acme.atlassian.net/rest/api/2/issue");

    const expectedAuth = Buffer.from("bot@acme.com:jira-api-token").toString("base64");
    expect(options.headers.Authorization).toBe(`Basic ${expectedAuth}`);

    const body = JSON.parse(options.body);
    expect(body.fields.project.key).toBe("SUP");
    expect(body.fields.summary).toBe("Cannot login");
    expect(body.fields.issuetype.name).toBe("Task");
    expect(body.fields.description).toContain("403 error");
    expect(body.fields.description).toContain("Transcript:");
  });

  it("uses fallback summary when no subject", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ key: "SUP-124", self: "..." }),
    });

    const data: TicketData = {
      siteId: "site-1",
      fields: { name: "Bob", description: "Need help" },
    };

    const provider = new JiraProvider(config);
    await provider.createTicket(data);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.fields.summary).toBe("Support ticket from Bob");
  });

  it("returns failure on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"errors":{"summary":"Field is required"}}',
    });

    const provider = new JiraProvider(config);
    const result = await provider.createTicket(ticketData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("400");
    expect(result.message).toContain("Field is required");
  });
});
