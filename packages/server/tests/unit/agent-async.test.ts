import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { runAgent, type AgentCallbacks } from "../../src/services/agent.js";
import { ToolExecutor } from "../../src/services/tools/executor.js";
import { ToolJobStore } from "../../src/services/tool-job-store.js";
import type { SiteConfig } from "@kody/shared";

// Mock the AI provider so we can control the agent's view of the
// tool-calling sequence.
vi.mock("../../src/services/ai-provider.js", () => ({
  streamChatCompletion: vi.fn(),
}));

import { streamChatCompletion } from "../../src/services/ai-provider.js";

const mockedStream = vi.mocked(streamChatCompletion);

/**
 * Helper that mocks a single streamChatCompletion invocation. If the
 * mock returns a final answer, it also feeds the content through the
 * `onToken` callback so the agent's `fullContent` accumulator picks
 * it up the same way the real provider would.
 */
function mockStream(
  returnValue: { content: string; toolCalls: unknown[]; finishReason: string },
  expect: typeof import("vitest").expect,
) {
  mockedStream.mockImplementationOnce(async (_config, _messages, callbacks) => {
    if (returnValue.finishReason === "stop" && returnValue.content) {
      // Emit the content as if it were streamed token-by-token.
      for (const ch of chunkString(returnValue.content, 8)) {
        callbacks.onToken(ch);
      }
      callbacks.onDone();
    }
    return returnValue;
  });
  // silence unused-arg lint
  void expect;
}

function chunkString(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

function makeConfig(): SiteConfig {
  return {
    siteId: "site-async",
    allowedOrigins: ["https://example.com"],
    ai: {
      baseUrl: "http://localhost:11434/v1",
      apiKey: "ollama",
      model: "llama3.2",
      temperature: 0,
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
      customTools: [
        {
          name: "build_report",
          description: "Build a long report",
          parameters: {
            type: "object",
            properties: { topic: { type: "string" } },
            required: [],
          },
          endpoint: {
            url: "https://example.com/run",
            method: "POST",
            headers: {},
            timeoutMs: 5000,
            async: true,
            asyncPollIntervalMs: 1,
            asyncPollUrl: "https://example.com/poll/fallback",
          },
        },
      ],
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

describe("runAgent — async tool branch", () => {
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
    mockedStream.mockReset();
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it("completes a turn with a tool that finishes in one async poll", async () => {
    // First AI call: emit a tool call to build_report.
    mockStream(
      {
        content: "",
        toolCalls: [
          { id: "call-1", function: { name: "build_report", arguments: '{"topic":"x"}' } },
        ],
        finishReason: "tool_calls",
      },
      expect,
    );
    // Second AI call (after the tool result): final answer.
    mockStream(
      { content: "All done.", toolCalls: [], finishReason: "stop" },
      expect,
    );

    // 202 dispatch to the tool endpoint.
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () =>
        Promise.resolve(
          JSON.stringify({ jobId: "job-1", pollUrl: "https://example.com/poll/1" }),
        ),
    } as unknown as Response);
    // Polling endpoint: first call says still running, second says succeeded.
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve(JSON.stringify({ status: "running", progress: 0.3 })),
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers(),
        text: () =>
          Promise.resolve(
            JSON.stringify({ status: "succeeded", result: "the report content" }),
          ),
      } as unknown as Response);

    const onToolProgress = vi.fn();
    const onToolStart = vi.fn();
    const onToolEnd = vi.fn();
    const callbacks: AgentCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onToolStart,
      onToolEnd,
      onToolProgress,
    };

    const result = await runAgent({
      config: makeConfig(),
      messages: [{ role: "user", content: "build it" }],
      toolExecutor: executor,
      tools: [],
      callbacks,
      scrubberConfig: {
        assistantName: "A",
        enableOutputScrubbing: false,
        blockedOutputPatterns: [],
        systemPromptFragments: [],
      },
      toolJobStore: store,
    });

    expect(result.content).toBe("All done.");
    expect(onToolStart).toHaveBeenCalledWith("build_report", expect.any(String));
    expect(onToolEnd).toHaveBeenCalledWith("build_report");
    // Progress is emitted at least once for initial state, once for
    // running, and once for succeeded.
    const progressStatuses = onToolProgress.mock.calls.map(
      (c) => (c[0] as { status: string }).status,
    );
    expect(progressStatuses).toContain("succeeded");
    expect(progressStatuses[progressStatuses.length - 1]).toBe("succeeded");

    // The job row reflects the final state.
    const jobs = store.list({ siteId: "site-async" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("succeeded");
  });

  it("times out the async tool after asyncMaxWaitMs", async () => {
    mockStream(
      {
        content: "",
        toolCalls: [{ id: "call-1", function: { name: "build_report", arguments: "{}" } }],
        finishReason: "tool_calls",
      },
      expect,
    );
    mockStream(
      { content: "Sorry, took too long.", toolCalls: [], finishReason: "stop" },
      expect,
    );

    // 202 dispatch.
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () =>
        Promise.resolve(JSON.stringify({ jobId: "job-2", pollUrl: "https://example.com/poll/2" })),
    } as unknown as Response);
    // The poll never returns a terminal status — just keep running.
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve(JSON.stringify({ status: "running" })),
    } as unknown as Response);

    const config = makeConfig();
    // Force a very short asyncMaxWaitMs so the test is quick.
    config.tools.asyncMaxWaitMs = 50;
    config.tools.customTools[0]!.endpoint.asyncPollIntervalMs = 10;

    const callbacks: AgentCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onToolStart: vi.fn(),
      onToolEnd: vi.fn(),
      onToolProgress: vi.fn(),
    };

    const result = await runAgent({
      config,
      messages: [{ role: "user", content: "build it" }],
      toolExecutor: executor,
      tools: [],
      callbacks,
      scrubberConfig: {
        assistantName: "A",
        enableOutputScrubbing: false,
        blockedOutputPatterns: [],
        systemPromptFragments: [],
      },
      toolJobStore: store,
    });

    expect(result.content).toBe("Sorry, took too long.");
    const job = store.list({ siteId: "site-async" })[0];
    expect(job?.status).toBe("timeout");
  });

  it("returns the failure result when the async tool fails", async () => {
    mockStream(
      {
        content: "",
        toolCalls: [{ id: "call-1", function: { name: "build_report", arguments: "{}" } }],
        finishReason: "tool_calls",
      },
      expect,
    );
    mockStream(
      { content: "Sorry, tool failed.", toolCalls: [], finishReason: "stop" },
      expect,
    );

    vi.mocked(fetch).mockResolvedValueOnce({
      status: 202,
      ok: true,
      headers: new Headers(),
      text: () =>
        Promise.resolve(JSON.stringify({ jobId: "job-3", pollUrl: "https://example.com/poll/3" })),
    } as unknown as Response);
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: () =>
        Promise.resolve(
          JSON.stringify({ status: "failed", error: "Out of memory" }),
        ),
    } as unknown as Response);

    const callbacks: AgentCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onToolStart: vi.fn(),
      onToolEnd: vi.fn(),
      onToolProgress: vi.fn(),
    };

    await runAgent({
      config: makeConfig(),
      messages: [{ role: "user", content: "build it" }],
      toolExecutor: executor,
      tools: [],
      callbacks,
      scrubberConfig: {
        assistantName: "A",
        enableOutputScrubbing: false,
        blockedOutputPatterns: [],
        systemPromptFragments: [],
      },
      toolJobStore: store,
    });

    const job = store.list({ siteId: "site-async" })[0];
    expect(job?.status).toBe("failed");
    expect(job?.errorMessage).toBe("Out of memory");
  });
});
