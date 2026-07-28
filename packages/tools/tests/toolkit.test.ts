import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { Toolkit, ToolRegistry, httpGet, httpPost, webhook, slack } from "../src/index.js";
import type { Tool } from "../src/index.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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
    expect(ct.endpoint.url).toBe("about:blank");
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

  it("webhook with secret signs body in X-Kody-Signature", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const w = webhook("https://example.com/h", { secret: "topsecret" });
    const result = await w.handler({ payload: JSON.stringify({ x: 1 }) });
    expect(result.ok).toBe(true);
    const [, opts] = mockFetch.mock.calls[0];
    const expected = createHmac("sha256", "topsecret").update(opts.body).digest("hex");
    expect(opts.headers["X-Kody-Signature"]).toBe(expected);
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
});
