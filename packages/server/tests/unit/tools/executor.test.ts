import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { ToolExecutor } from "../../../src/services/tools/executor.js";
import type { SiteConfig, CustomTool } from "@kody/shared";
import type { ToolCallRequest } from "../../../src/services/ai-provider.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeConfig(customTools: CustomTool[] = []): SiteConfig {
  return {
    siteId: "site-test",
    allowedOrigins: ["https://example.com"],
    ai: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" } as SiteConfig["ai"],
    guardrails: {
      allowedTopics: ["help"],
      topicDescription: "Help with anything",
    } as SiteConfig["guardrails"],
    tools: {
      enabled: true,
      maxToolCalls: 5,
      customTools,
      builtinTools: { knowledgeSearch: true },
    },
  } as SiteConfig;
}

const httpTool: CustomTool = {
  name: "ping",
  description: "ping an endpoint",
  parameters: { type: "object", properties: {}, required: [] },
  endpoint: {
    url: "https://api.example.com/ping",
    method: "POST",
    headers: {},
    timeoutMs: 5000,
  },
};

const signedTool: CustomTool = {
  ...httpTool,
  name: "signed",
  endpoint: { ...httpTool.endpoint, secret: "topsecret" },
};

describe("ToolExecutor", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns parsed body on 2xx", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, value: 1 }),
    });
    const exec = new ToolExecutor(null);
    const call: ToolCallRequest = {
      id: "tc1",
      function: { name: "ping", arguments: "{}" },
    };
    const result = await exec.execute(call, makeConfig([httpTool]));
    expect(result.ok).toBe(true);
    expect(result.result).toBe(JSON.stringify({ ok: true, value: 1 }));
    expect(result.name).toBe("ping");
  });

  it("returns structured error on 500 (no throw)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      { id: "tc1", function: { name: "ping", arguments: "{}" } },
      makeConfig([httpTool]),
    );
    expect(result.ok).toBe(false);
    expect(result.result).toContain("500");
    expect(result.result).toContain("boom");
  });

  it("returns structured timeout result when the request is aborted", async () => {
    mockFetch.mockImplementation(
      (_url, init: { signal?: AbortSignal } = {} as { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    const tool: CustomTool = {
      ...httpTool,
      endpoint: { ...httpTool.endpoint, timeoutMs: 50 },
    };
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      { id: "tc1", function: { name: "ping", arguments: "{}" } },
      makeConfig([tool]),
    );
    expect(result.ok).toBe(false);
    expect(result.result.toLowerCase()).toMatch(/abort|timeout|exceeded/);
  });

  it("returns a graceful error when the response is not valid JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<html>not json</html>",
    });
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      { id: "tc1", function: { name: "ping", arguments: "{}" } },
      makeConfig([httpTool]),
    );
    expect(result.ok).toBe(true);
    expect(result.result).toBe("<html>not json</html>");
  });

  it("returns structured 'Unknown tool' when the name is not registered", async () => {
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      { id: "tc1", function: { name: "ghost", arguments: "{}" } },
      makeConfig([]),
    );
    expect(result.ok).toBe(false);
    expect(result.result).toContain("Unknown tool");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 'Invalid arguments' when JSON fails to parse", async () => {
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      { id: "tc1", function: { name: "ping", arguments: "not json" } },
      makeConfig([httpTool]),
    );
    expect(result.ok).toBe(false);
    expect(result.result).toContain("Invalid arguments");
  });

  it("dispatches builtin knowledge_search", async () => {
    const exec = new ToolExecutor({
      hasIndex: () => true,
      retrieve: async () => [],
      formatAsContext: () => "context block",
    } as never);
    const config = makeConfig([]);
    config.knowledge = {
      sources: [],
      maxContextTokens: 4000,
      rag: { enabled: false, chunkSize: 500, chunkOverlap: 50, topK: 5, similarityThreshold: 0.3 },
    } as SiteConfig["knowledge"];
    const result = await exec.execute(
      { id: "tc1", function: { name: "knowledge_search", arguments: '{"query":"x"}' } },
      config,
    );
    expect(result.ok).toBe(true);
    expect(result.name).toBe("knowledge_search");
  });

  it("dispatches builtin create_ticket via ticket provider", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({ success: true, ticketId: "T-1", ticketUrl: "https://x.test/T-1" }),
    });
    const config = makeConfig([]);
    config.tickets = {
      enabled: true,
      promptMessage: "",
      requiredFields: ["email", "description"],
      providers: [
        {
          provider: "webhook",
          url: "https://hooks.example.com/tickets",
          method: "POST",
          headers: {},
        },
      ],
    } as SiteConfig["tickets"];
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      {
        id: "tc1",
        function: {
          name: "create_ticket",
          arguments: JSON.stringify({ email: "a@b.test", description: "help" }),
        },
      },
      config,
    );
    expect(result.ok).toBe(true);
    expect(result.name).toBe("create_ticket");
  });

  it("signs body with HMAC when endpoint.secret is set", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const exec = new ToolExecutor(null);
    await exec.execute(
      { id: "tc1", function: { name: "signed", arguments: "{}" } },
      makeConfig([signedTool]),
    );
    const [, opts] = mockFetch.mock.calls[0];
    const expected = createHmac("sha256", "topsecret").update(opts.body).digest("hex");
    expect(opts.headers["X-Kody-Signature"]).toBe(expected);
  });

  it("applies bearer auth when endpoint.auth.type === 'bearer'", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const tool: CustomTool = {
      ...httpTool,
      name: "bearerTool",
      endpoint: {
        ...httpTool.endpoint,
        auth: { type: "bearer", value: "abc123", fromEnv: false },
      },
    };
    const exec = new ToolExecutor(null);
    await exec.execute(
      { id: "tc1", function: { name: "bearerTool", arguments: "{}" } },
      makeConfig([tool]),
    );
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe("Bearer abc123");
  });

  it("retries on transient 503 and eventually returns the last response", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "down" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"ok":true}' });
    const tool: CustomTool = {
      ...httpTool,
      endpoint: { ...httpTool.endpoint, retry: { maxAttempts: 2, baseDelayMs: 5 } },
    };
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      { id: "tc1", function: { name: "ping", arguments: "{}" } },
      makeConfig([tool]),
    );
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("resolves auth from process.env when fromEnv is true", async () => {
    process.env.MY_TEST_TOKEN = "env-token-xyz";
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const tool: CustomTool = {
      ...httpTool,
      name: "envTool",
      endpoint: {
        ...httpTool.endpoint,
        auth: { type: "bearer", value: "MY_TEST_TOKEN", fromEnv: true },
      },
    };
    const exec = new ToolExecutor(null);
    await exec.execute(
      { id: "tc1", function: { name: "envTool", arguments: "{}" } },
      makeConfig([tool]),
    );
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe("Bearer env-token-xyz");
    delete process.env.MY_TEST_TOKEN;
  });

  it("dispatches to a registered ToolRegistry handler when declared as in-process", async () => {
    const exec = new ToolExecutor(null);
    exec.getRegistry().register("inproc", async () => ({ ok: true, message: "from registry" }));
    const result = await exec.execute(
      { id: "tc1", function: { name: "inproc", arguments: "{}" } },
      makeConfig([
        {
          name: "inproc",
          description: "in-process tool",
          parameters: { type: "object", properties: {}, required: [] },
          endpoint: {
            url: "kody://inproc/__kody_internal__",
            method: "POST",
            headers: {},
            timeoutMs: 5000,
          },
        },
      ]),
    );
    expect(result.ok).toBe(true);
    expect(result.result).toContain("from registry");
  });

  it("fails explicitly when an in-process handler has no matching customTools entry", async () => {
    const exec = new ToolExecutor(null);
    exec.getRegistry().register("ghost", async () => ({ ok: true, message: "should not run" }));
    const result = await exec.execute(
      { id: "tc1", function: { name: "ghost", arguments: "{}" } },
      makeConfig([]),
    );
    expect(result.ok).toBe(false);
    expect(result.result).toContain("not declared");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("attaches an Idempotency-Key when retry is configured for a non-idempotent method", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    const tool: CustomTool = {
      ...httpTool,
      name: "postWithRetry",
      endpoint: { ...httpTool.endpoint, retry: { maxAttempts: 2, baseDelayMs: 5 } },
    };
    const exec = new ToolExecutor(null);
    await exec.execute(
      { id: "tc1", function: { name: "postWithRetry", arguments: "{}" } },
      makeConfig([tool]),
    );
    const [, opts] = mockFetch.mock.calls[0];
    expect(typeof opts.headers["Idempotency-Key"]).toBe("string");
    expect(opts.headers["Idempotency-Key"].length).toBeGreaterThan(0);
  });

  it("returns a structured auth failure when an env-resolved auth var is missing", async () => {
    const tool: CustomTool = {
      ...httpTool,
      name: "missingEnv",
      endpoint: {
        ...httpTool.endpoint,
        auth: { type: "bearer", value: "DOES_NOT_EXIST_TOKEN", fromEnv: true },
      },
    };
    const exec = new ToolExecutor(null);
    const result = await exec.execute(
      { id: "tc1", function: { name: "missingEnv", arguments: "{}" } },
      makeConfig([tool]),
    );
    expect(result.ok).toBe(false);
    expect(result.result).toContain("auth");
    expect(result.result).toContain("DOES_NOT_EXIST_TOKEN");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("GET request omits the body and serialises arguments into the query string", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    const tool: CustomTool = {
      ...httpTool,
      name: "search",
      endpoint: { ...httpTool.endpoint, method: "GET" as const },
    };
    const exec = new ToolExecutor(null);
    await exec.execute(
      {
        id: "tc1",
        function: {
          name: "search",
          arguments: JSON.stringify({ q: "kody", page: 2, skip: null }),
        },
      },
      makeConfig([tool]),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain("https://api.example.com/ping");
    expect(calledUrl).toContain("q=kody");
    expect(calledUrl).toContain("page=2");
    // Nullish values must be skipped, not serialised as `skip=null`.
    expect(calledUrl).not.toContain("skip=");
    // The body is omitted entirely for bodyless methods.
    expect(calledOpts.body).toBeUndefined();
    // Content-Type is not set when no body is sent.
    expect(calledOpts.headers["Content-Type"]).toBeUndefined();
  });

  it("GET request with a pre-existing query string preserves it", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    const tool: CustomTool = {
      ...httpTool,
      name: "search",
      endpoint: {
        ...httpTool.endpoint,
        method: "GET" as const,
        url: "https://api.example.com/search?preset=demo",
      },
    };
    const exec = new ToolExecutor(null);
    await exec.execute(
      {
        id: "tc1",
        function: { name: "search", arguments: JSON.stringify({ q: "kody" }) },
      },
      makeConfig([tool]),
    );
    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain("preset=demo");
    expect(calledUrl).toContain("q=kody");
  });
});
