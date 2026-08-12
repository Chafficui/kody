import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  Toolkit,
  ToolRegistry,
  httpGet,
  httpPost,
  httpGetWithHosts,
  httpPostWithHosts,
  webhook,
  slack,
  linear,
  sendgridEmail,
  INPROC_TOOL_MARKER,
  httpCall,
  type Tool,
} from "../src/index.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Tests run in an environment without outbound DNS. Stub `node:dns/promises`
// so any hostname resolves to a public IP and the SSRF guard accepts it.
// Hostnames that match the SSRF blocklist (localhost, 127.0.0.1, private
// ranges, metadata, etc.) are caught by the synchronous check and never
// reach the DNS lookup, so they remain rejected.
vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn().mockImplementation(async (host: string) => {
      if (host === "1.2.3.4") return [{ address: "1.2.3.4", family: 4 }];
      return [{ address: "93.184.216.34", family: 4 }];
    }),
  },
  lookup: vi.fn().mockImplementation(async (host: string) => {
    if (host === "1.2.3.4") return [{ address: "1.2.3.4", family: 4 }];
    return [{ address: "93.184.216.34", family: 4 }];
  }),
}));

function makeStubTool(name: string): Tool {
  return {
    definition: {
      type: "function",
      function: {
        name,
        description: `stub ${name}`,
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    handler: async () => ({ ok: true, message: `${name} ran` }),
  };
}

describe("Toolkit", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("adds tools and exposes them in export()", () => {
    const t = new Toolkit().add(makeStubTool("foo")).add(makeStubTool("bar"));
    const out = t.export();
    expect(t.names()).toEqual(["foo", "bar"]);
    expect(out.customTools).toHaveLength(2);
    expect(out.customTools[0].name).toBe("foo");
    expect(out.handlers.get("foo")).toBeTypeOf("function");
  });

  it("rejects duplicate names", () => {
    expect(() => new Toolkit().add(makeStubTool("dup")).add(makeStubTool("dup"))).toThrow(
      /already registered/,
    );
  });

  it("remove() drops an entry", () => {
    const t = new Toolkit().add(makeStubTool("a")).add(makeStubTool("b"));
    t.remove("a");
    expect(t.names()).toEqual(["b"]);
  });

  it("addAs() renames a tool", () => {
    const t = new Toolkit().addAs("renamed", makeStubTool("original"));
    expect(t.names()).toEqual(["renamed"]);
    expect(t.export().customTools[0].name).toBe("renamed");
  });

  it("export() returns customTools compatible with SiteConfig", () => {
    const t = new Toolkit().add(webhook("https://example.com/h"));
    const [ct] = t.export().customTools;
    expect(ct.name).toBe("webhook");
    expect(ct.parameters.type).toBe("object");
    expect(ct.endpoint.url).toBe(INPROC_TOOL_MARKER);
  });

  it("add() rejects when an existing tool already exposes the incoming function name under a different alias", () => {
    const t = new Toolkit().addAs("first", makeStubTool("alpha"));
    expect(() => t.add(makeStubTool("alpha"))).toThrow(
      /already registered as "first"/,
    );
  });

  it("addAs() rejects when the incoming function name is already registered under a different alias", () => {
    const t = new Toolkit().add(makeStubTool("alpha"));
    expect(() => t.addAs("second", makeStubTool("alpha"))).toThrow(
      /already registered as "alpha"/,
    );
  });
});

describe("ToolRegistry", () => {
  it("register / get / unregister", () => {
    const r = new ToolRegistry();
    const h = async () => ({ ok: true, message: "x" });
    r.register("t", h);
    expect(r.get("t")).toBe(h);
    r.unregister("t");
    expect(r.get("t")).toBeUndefined();
  });

  it("merge combines two registries, last write wins", () => {
    const a = new ToolRegistry();
    a.register("shared", async () => ({ ok: true, message: "a" }));
    a.register("only-a", async () => ({ ok: true, message: "a" }));
    const b = new ToolRegistry();
    b.register("shared", async () => ({ ok: true, message: "b" }));
    b.register("only-b", async () => ({ ok: true, message: "b" }));
    a.merge(b);
    expect(a.names().sort()).toEqual(["only-a", "only-b", "shared"]);
  });

  it("handlers in export() are dispatchable", async () => {
    const t = new Toolkit().add(slack({ token: "xoxb-test", channel: "#general" }));
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, ts: "1700000000.000100" }),
    });
    const handler = t.export().handlers.get("slack_post_message");
    expect(handler).toBeDefined();
    const result = await handler!({ text: "hi" });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("1700000000.000100");
  });
});

describe("prebuilt factories", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("httpGet sends GET and returns parsed JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ hello: "world" }),
    });
    const result = await httpGet.handler({ url: "https://api.example.com/ping" });
    expect(result.ok).toBe(true);
    expect((result.data as { hello: string }).hello).toBe("world");
    const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain("https://api.example.com/ping");
    expect(calledOpts.method).toBe("GET");
  });

  it("httpGet honours jsonPath", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { value: 42 } }),
    });
    const result = await httpGet.handler({
      url: "https://api.example.com/ping",
      jsonPath: "data.value",
    });
    expect(result.data).toBe(42);
  });

  it("httpGet with no body omits the query string on the URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
    // httpGet's `body` is a JSON-encoded string; null is rejected by the
    // arg schema. The underlying null-body handling for httpCall is
    // covered in tests/http.test.ts.
    const result = await httpGet.handler({ url: "https://api.example.com/ping" });
    expect(result.ok).toBe(true);
    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://api.example.com/ping");
  });

  it("httpGet returns ok=false on non-2xx upstream", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "missing",
    });
    const result = await httpGet.handler({ url: "https://api.example.com/missing" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("404");
    expect(result.message).toContain("missing");
  });

  it("httpGet returns ok=false on malformed query JSON", async () => {
    const result = await httpGet.handler({
      url: "https://api.example.com/ping",
      query: "{not-valid",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/query.*JSON/);
  });

  it("httpGet returns ok=false on malformed headers JSON", async () => {
    const result = await httpGet.handler({
      url: "https://api.example.com/ping",
      headers: "[1,2,3]",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/headers.*JSON/);
  });

  it("httpGet returns ok=false when a header value is not a string", async () => {
    const result = await httpGet.handler({
      url: "https://api.example.com/ping",
      headers: JSON.stringify({ "X-Foo": 123 }),
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/headers.*string/);
  });

  it("httpGet rejects loopback / private hosts (SSRF)", async () => {
    for (const blocked of [
      "http://127.0.0.1/x",
      "http://localhost/x",
      "http://10.0.0.1/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.1.1/x",
      "http://172.16.0.1/x",
      "http://[::1]/x",
      "http://[fc00::1]/x",
      // IPv4-mapped IPv6, dotted form.
      "http://[::ffff:127.0.0.1]/x",
      // IPv4-mapped IPv6, hex form — would bypass the SSRF guard if
      // the validator only accepted the dotted form. 7f00:1 == 127.0.0.1.
      "http://[::ffff:7f00:1]/x",
      // Hex-form mapped to a different private range, 0a00:1 == 10.0.0.1.
      "http://[::ffff:0a00:1]/x",
      "file:///etc/passwd",
    ]) {
      const result = await httpGet.handler({ url: blocked });
      expect(result.ok).toBe(false);
      // The rejection reason must mention the literal IP / loopback, not
      // a generic "invalid" — DNS-failure messages would also match a
      // looser pattern, and we want the SSRF guard to be the thing that
      // rejected the request.
      expect(result.message).toMatch(/private|loopback|refusing|non-http/);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("httpGetWithHosts rejects URLs outside the allowlist", async () => {
    const tool = httpGetWithHosts(["api.example.com"]);
    const result = await tool.handler({ url: "https://other.test/x" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not in the allowlist/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("httpGetWithHosts calls fetch when the host is in the allowlist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
    const tool = httpGetWithHosts(["api.example.com"]);
    const result = await tool.handler({ url: "https://api.example.com/x" });
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("httpPostWithHosts requires a body and enforces the host allowlist", async () => {
    const tool = httpPostWithHosts(["api.example.com"]);
    // No body → 400-equivalent tool failure.
    const noBody = await tool.handler({ url: "https://api.example.com/x" });
    expect(noBody.ok).toBe(false);
    expect(noBody.message).toMatch(/body is required/);
    // Off-allowlist host → blocked.
    const offList = await tool.handler({
      url: "https://other.test/x",
      body: JSON.stringify({ a: 1 }),
    });
    expect(offList.ok).toBe(false);
    expect(offList.message).toMatch(/not in the allowlist/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("httpGet appends `path` to the URL while preserving query / fragment", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
    const result = await httpGet.handler({
      url: "https://api.example.com/x?token=abc",
      path: "/inner",
    });
    expect(result.ok).toBe(true);
    const [calledUrl] = mockFetch.mock.calls[0];
    // The slash + path lands BEFORE the query string, not after it.
    expect(calledUrl).toBe("https://api.example.com/x/inner?token=abc");
  });

  it("httpGet allows loopback when an allowlist is passed via the low-level helper", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
    const result = await httpCall({
      url: "https://api.example.com/ping",
      method: "GET",
      allowedHosts: ["api.example.com"],
    });
    expect(result.ok).toBe(true);
  });

  it("httpPost sends body as JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ accepted: true }),
    });
    const result = await httpPost.handler({
      url: "https://api.example.com/post",
      body: JSON.stringify({ name: "x" }),
    });
    expect(result.ok).toBe(true);
    const [, opts] = mockFetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ name: "x" });
  });

  it("httpPost returns ok=false when body is missing", async () => {
    const result = await httpPost.handler({ url: "https://api.example.com/post" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/body is required/);
  });

  it("httpPost returns ok=false on malformed body JSON", async () => {
    const result = await httpPost.handler({
      url: "https://api.example.com/post",
      body: "{not-valid",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/body.*JSON/);
  });

  it("httpCall retries transient 503 and succeeds on the next attempt", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "down" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"ok":true}' });
    const r = await httpCall({
      url: "https://api.example.com/ping",
      method: "GET",
      retry: { maxAttempts: 2, baseDelayMs: 5 },
    });
    expect(r.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("httpCall does NOT retry POST on transient 503 without an idempotency key", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, text: async () => "down" });
    const r = await httpCall({
      url: "https://api.example.com/post",
      method: "POST",
      retry: { maxAttempts: 3, baseDelayMs: 5 },
    });
    expect(r.ok).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("httpCall DOES retry POST when an idempotency key is supplied", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "down" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"ok":true}' });
    const r = await httpCall({
      url: "https://api.example.com/post",
      method: "POST",
      retry: { maxAttempts: 2, baseDelayMs: 5 },
      idempotencyKey: "abc-123",
    });
    expect(r.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, opts1] = mockFetch.mock.calls[0];
    const [, opts2] = mockFetch.mock.calls[1];
    expect(opts1.headers["Idempotency-Key"]).toBe("abc-123");
    expect(opts2.headers["Idempotency-Key"]).toBe("abc-123");
  });

  it("webhook with secret signs body in X-Kody-Signature", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const w = webhook("https://example.com/h", { secret: "topsecret" });
    const result = await w.handler({ payload: JSON.stringify({ x: 1 }) });
    expect(result.ok).toBe(true);
    const [, opts] = mockFetch.mock.calls[0];
    const expected = createHmac("sha256", "topsecret").update(opts.body).digest("hex");
    expect(opts.headers["X-Kody-Signature"]).toBe(expected);
  });

  it("webhook returns ok=false on malformed payload JSON", async () => {
    const w = webhook("https://example.com/h");
    const result = await w.handler({ payload: "{not-valid" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/payload.*JSON/);
  });

  it("slack() returns ok=false on Slack API error envelope", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: false, error: "channel_not_found" }),
    });
    const tool = slack({ token: "xoxb-test", channel: "#missing" });
    const result = await tool.handler({ text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("channel_not_found");
  });

  it("linear() creates an issue via the GraphQL endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: { issueCreate: { success: true, issue: { identifier: "ABC-1", url: "https://linear.app/x/issue/ABC-1" } } },
        }),
    });
    const tool = linear({ apiKey: "lin_api_test", teamId: "team-uuid" });
    const result = await tool.handler({ title: "Bug", description: "Steps to reproduce" });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("ABC-1");
    const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://api.linear.app/graphql");
    const body = JSON.parse(calledOpts.body);
    expect(body.variables.input.teamId).toBe("team-uuid");
    expect(body.variables.input.title).toBe("Bug");
    expect(calledOpts.headers["Authorization"]).toBe("Bearer lin_api_test");
  });

  it("linear() returns ok=false on GraphQL errors", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errors: [{ message: "boom" }] }),
    });
    const tool = linear({ apiKey: "lin_api_test", teamId: "team-uuid" });
    const result = await tool.handler({ title: "Bug" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("boom");
  });

  it("linear() returns ok=false when title is missing", async () => {
    const tool = linear({ apiKey: "lin_api_test", teamId: "team-uuid" });
    const result = await tool.handler({});
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/title is required/);
  });

  it("sendgridEmail() sends a transactional email", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => "",
    });
    const tool = sendgridEmail({ apiKey: "SG.test", from: "no-reply@example.com" });
    const result = await tool.handler({
      to: "user@example.com",
      subject: "Hi",
      text: "Hello!",
    });
    expect(result.ok).toBe(true);
    const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe("https://api.sendgrid.com/v3/mail/send");
    const body = JSON.parse(calledOpts.body);
    expect(body.personalizations[0].to[0].email).toBe("user@example.com");
    expect(body.from.email).toBe("no-reply@example.com");
    expect(calledOpts.headers["Authorization"]).toBe("Bearer SG.test");
  });

  it("sendgridEmail() returns ok=false when required fields are missing", async () => {
    const tool = sendgridEmail({ apiKey: "SG.test", from: "no-reply@example.com" });
    const result = await tool.handler({ to: "user@example.com" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/required/);
  });

  it("sendgridEmail() returns ok=false on non-2xx upstream", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"errors":[{"message":"bad key"}]}',
    });
    const tool = sendgridEmail({ apiKey: "SG.bad", from: "no-reply@example.com" });
    const result = await tool.handler({
      to: "user@example.com",
      subject: "Hi",
      text: "Hello!",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});
