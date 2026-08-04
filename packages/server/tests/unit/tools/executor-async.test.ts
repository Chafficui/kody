import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../../../src/db/migrate.js";
import { ToolExecutor } from "../../../src/services/tools/executor.js";
import { ToolJobStore } from "../../../src/services/tool-job-store.js";
import type { SiteConfig, CustomTool } from "@kody/shared";

function makeConfig(asyncTool: Partial<CustomTool> = {}): SiteConfig {
  const baseEndpoint = {
    url: "https://example.com/run",
    method: "POST" as const,
    headers: {},
    timeoutMs: 5000,
    async: true,
    asyncPollIntervalMs: 10,
  };
  // Spread the rest of the override first, then place the merged
  // endpoint last so it isn't overwritten by `...asyncTool`.
  const tool: CustomTool = {
    name: "build_report",
    description: "Build a long report",
    parameters: {
      type: "object",
      properties: { topic: { type: "string" } },
      required: ["topic"],
    },
    ...asyncTool,
    endpoint: { ...baseEndpoint, ...(asyncTool.endpoint ?? {}) } as CustomTool["endpoint"],
  } as CustomTool;
  return {
    siteId: "site-async",
    allowedOrigins: ["https://example.com"],
    ai: {
      baseUrl: "http://localhost:11434/v1",
      apiKey: "ollama",
      model: "llama3.2",
      temperature: 0.7,
      maxTokens: 256,
      retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    },
    guardrails: {
      allowedTopics: ["x"],
      topicDescription: "x",
    },
    knowledge: { sources: [], maxContextTokens: 4000, rag: { enabled: false } },
    tickets: { enabled: false, promptMessage: "", providers: [], requiredFields: [] },
    tools: {
      enabled: true,
      maxToolCalls: 5,
      customTools: [tool],
      builtinTools: { knowledgeSearch: false },
      asyncMaxWaitMs: 5000,
    },
    rateLimit: { messagesPerMinute: 60, messagesPerHour: 1000, messagesPerDay: 10000 },
    personality: { tone: "friendly", formality: "balanced", responseLength: "balanced" },
    compliance: {
      aiDisclosureEnabled: true,
      aiDisclosureMessage: "AI",
      conversationDeletionEnabled: true,
    },
    cache: { enabled: false, ttlSeconds: 3600, maxEntries: 1000 },
    conversationStarters: [],
    enabled: true,
  };
}

function makeCall(name: string, args: Record<string, unknown> = { topic: "x" }) {
  return {
    id: "call-1",
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

describe("ToolExecutor — async dispatch", () => {
  let db: Database.Database;
  let store: ToolJobStore;
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    store = new ToolJobStore(db);
    executor = new ToolExecutor(null, store);
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends X-Kody-Async header on async dispatch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify({ jobId: "job-1", pollUrl: "https://example.com/poll/1" })),
    } as unknown as Response);

    const config = makeConfig();
    const result = await executor.execute(makeCall("build_report"), config);

    expect(result.async).toBeDefined();
    expect(result.async?.jobId).toBe("job-1");
    expect(result.async?.pollUrl).toBe("https://example.com/poll/1");
    const call = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = call.headers as Record<string, string>;
    expect(headers["X-Kody-Async"]).toBe("true");
  });

  it("persists a tool_jobs row on 202 dispatch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify({ jobId: "job-abc" })),
    } as unknown as Response);

    const config = makeConfig();
    const result = await executor.execute(makeCall("build_report"), config);

    expect(result.async?.jobId).toBe("job-abc");
    const jobs = store.list({ siteId: "site-async" });
    // The executor threads the endpoint-supplied jobId straight
    // into toolJobStore.create so the persisted row shares the
    // endpoint's handle, not a fresh UUID.
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.jobId).toBe("job-abc");
    expect(jobs[0]?.toolName).toBe("build_report");
    expect(jobs[0]?.status).toBe("pending");
  });

  it("falls back to endpoint.asyncPollUrl when 202 response has no pollUrl", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify({ jobId: "job-2" })),
    } as unknown as Response);

    const config = makeConfig({
      endpoint: { asyncPollUrl: "https://example.com/poll/fallback" },
    } as Partial<CustomTool>);
    // Sanity check: the override is merged into the endpoint.
    const tool = config.tools.customTools[0]!;
    expect(tool.endpoint.asyncPollUrl).toBe("https://example.com/poll/fallback");
    expect(tool.endpoint.async).toBe(true);

    const result = await executor.execute(makeCall("build_report"), config);

    expect(result.async?.pollUrl).toBe("https://example.com/poll/fallback");
  });

  it("treats a 200 response as a synchronous result (no async field)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve("instant result"),
    } as unknown as Response);

    const config = makeConfig();
    const result = await executor.execute(makeCall("build_report"), config);

    expect(result.async).toBeUndefined();
    expect(result.result).toBe("instant result");
    expect(store.list({ siteId: "site-async" })).toHaveLength(0);
  });

  it("returns an error result when 202 body has no jobId", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve("not json"),
    } as unknown as Response);

    const config = makeConfig();
    const result = await executor.execute(makeCall("build_report"), config);

    expect(result.async).toBeUndefined();
    expect(result.result).toContain("no jobId");
  });

  it("returns a 5xx error as a regular tool error (no async branch)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 500,
      ok: false,
      headers: new Headers(),
      text: () => Promise.resolve("oops"),
    } as unknown as Response);

    const config = makeConfig();
    const result = await executor.execute(makeCall("build_report"), config);

    expect(result.async).toBeUndefined();
    expect(result.result).toContain("Tool returned error 500");
  });

  it("non-async tools still go through the old synchronous path", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve("sync result"),
    } as unknown as Response);

    const config = makeConfig({ endpoint: { async: false } } as Partial<CustomTool>);
    const result = await executor.execute(makeCall("build_report"), config);

    expect(result.async).toBeUndefined();
    expect(result.result).toBe("sync result");
    const call = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = call.headers as Record<string, string>;
    expect(headers["X-Kody-Async"]).toBeUndefined();
  });

  it("executes without a toolJobStore (legacy wiring still works)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify({ jobId: "job-3" })),
    } as unknown as Response);

    const legacyExecutor = new ToolExecutor(null);
    const config = makeConfig();
    const result = await legacyExecutor.execute(makeCall("build_report"), config);

    expect(result.async?.jobId).toBe("job-3");
    // Without a store the dispatch still works; we just don't persist.
    expect(store.list({ siteId: "site-async" })).toHaveLength(0);
  });
});

describe("ToolJobStore", () => {
  let db: Database.Database;
  let store: ToolJobStore;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    store = new ToolJobStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates and retrieves a job", () => {
    const job = store.create({
      siteId: "site-a",
      sessionId: "sess-1",
      toolName: "build_report",
      endpointUrl: "https://example.com/run",
      pollUrl: "https://example.com/poll/1",
    });
    expect(job.jobId).toBeDefined();
    expect(job.status).toBe("pending");
    const fetched = store.get(job.jobId);
    expect(fetched?.toolName).toBe("build_report");
  });

  it("getForSite returns null for cross-site access", () => {
    const job = store.create({
      siteId: "site-a",
      sessionId: "sess-1",
      toolName: "build_report",
      endpointUrl: "https://example.com/run",
    });
    expect(store.getForSite(job.jobId, "site-b")).toBeNull();
    expect(store.getForSite(job.jobId, "site-a")?.jobId).toBe(job.jobId);
  });

  it("update sets completed_at when status is terminal", () => {
    const job = store.create({
      siteId: "site-a",
      sessionId: "sess-1",
      toolName: "build_report",
      endpointUrl: "https://example.com/run",
    });
    const updated = store.update(job.jobId, {
      status: "succeeded",
      result: "the result",
    });
    expect(updated?.status).toBe("succeeded");
    expect(updated?.result).toBe("the result");
    expect(updated?.completedAt).not.toBeNull();
  });

  it("delete and deleteForSite", () => {
    const job = store.create({
      siteId: "site-a",
      sessionId: "sess-1",
      toolName: "build_report",
      endpointUrl: "https://example.com/run",
    });
    expect(store.delete(job.jobId)).toBe(1);
    expect(store.get(job.jobId)).toBeNull();
    store.create({
      siteId: "site-a",
      sessionId: "sess-1",
      toolName: "x",
      endpointUrl: "y",
    });
    store.create({
      siteId: "site-b",
      sessionId: "sess-1",
      toolName: "x",
      endpointUrl: "y",
    });
    expect(store.deleteForSite("site-a")).toBe(1);
    expect(store.list()).toHaveLength(1);
  });
});
