import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubProvider } from "../../../src/services/tickets/github.js";
import type { TicketData } from "../../../src/services/tickets/types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const config = {
  provider: "github" as const,
  owner: "acme",
  repo: "support",
  token: "ghp_test-token",
  labels: ["kody", "support"],
};

const fullTicketData: TicketData = {
  siteId: "site-1",
  fields: {
    name: "Alice",
    email: "alice@example.com",
    subject: "Cannot login",
    description: "I keep getting a 403 error when logging in.",
  },
  transcript: "User: I cannot login\nAssistant: Let me create a ticket for you.",
};

const minimalTicketData: TicketData = {
  siteId: "site-1",
  fields: {
    description: "Something is broken.",
  },
};

describe("GitHubProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("creates an issue with correct API URL, auth, and body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 42, html_url: "https://github.com/acme/support/issues/42" }),
    });

    const provider = new GitHubProvider(config);
    const result = await provider.createTicket(fullTicketData);

    expect(result.success).toBe(true);
    expect(result.ticketId).toBe("42");
    expect(result.ticketUrl).toBe("https://github.com/acme/support/issues/42");
    expect(result.message).toBe("GitHub issue created");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme/support/issues");
    expect(options.headers.Authorization).toBe("Bearer ghp_test-token");
    expect(options.headers.Accept).toBe("application/vnd.github+json");

    const body = JSON.parse(options.body);
    expect(body.title).toBe("[Kody] Cannot login");
    expect(body.labels).toEqual(["kody", "support"]);
    expect(body.body).toContain("**Name:** Alice");
    expect(body.body).toContain("**Email:** alice@example.com");
    expect(body.body).toContain("403 error");
    expect(body.body).toContain("Transcript:");
  });

  it("uses fallback title with name when no subject", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 1, html_url: "https://github.com/acme/support/issues/1" }),
    });

    const data: TicketData = {
      siteId: "site-1",
      fields: { name: "Bob", description: "Help me" },
    };

    const provider = new GitHubProvider(config);
    await provider.createTicket(data);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.title).toBe("[Kody] Support ticket from Bob");
  });

  it("uses generic fallback title with minimal fields", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 2, html_url: "https://github.com/acme/support/issues/2" }),
    });

    const provider = new GitHubProvider(config);
    await provider.createTicket(minimalTicketData);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.title).toBe("[Kody] Support ticket from user");
  });

  it("omits transcript section when not provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 3, html_url: "https://github.com/acme/support/issues/3" }),
    });

    const provider = new GitHubProvider(config);
    await provider.createTicket(minimalTicketData);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.body).not.toContain("Transcript:");
  });

  it("returns failure on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"message":"Validation Failed"}',
    });

    const provider = new GitHubProvider(config);
    const result = await provider.createTicket(fullTicketData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("422");
    expect(result.message).toContain("Validation Failed");
  });
});
