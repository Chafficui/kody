import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runAgent, type AgentCallbacks } from "../../../src/services/agent.js";
import type { ToolExecutor } from "../../../src/services/tools/executor.js";
import type { SiteConfig } from "@kody/shared";

// ---------------------------------------------------------------------------
// SSE helper — returns a Response-like object that the ai-provider can stream
// from. Mirrors the wire format used by OpenAI-compatible chat completion
// streaming endpoints.
// ---------------------------------------------------------------------------

/**
 * Build a function that, on every fetch call, returns a *fresh* Response
 * with a fresh ReadableStream. Streams can only be read once, so the
 * factory pattern is required when the same response should be served
 * multiple times in a loop.
 */
function sseResponseFactory(chunks: Array<Record<string, unknown>>): () => Response {
  const payload = (() => {
    const lines: string[] = [];
    for (const chunk of chunks) {
      lines.push(`data: ${JSON.stringify(chunk)}`);
    }
    lines.push("data: [DONE]");
    return lines.join("\n\n") + "\n\n";
  })();
  return () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload));
        controller.close();
      },
    });
    return { ok: true, status: 200, body } as unknown as Response;
  };
}

function makeConfig(overrides: Partial<SiteConfig["tools"]> = {}): SiteConfig {
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
      maxToolCalls: 3,
      customTools: [],
      builtinTools: { knowledgeSearch: true },
      ...overrides,
    },
  } as SiteConfig;
}

function makeCallbacks() {
  const calls: { event: string; payload: unknown }[] = [];
  const cb: AgentCallbacks = {
    onToken: (t) => calls.push({ event: "token", payload: t }),
    onDone: () => calls.push({ event: "done", payload: null }),
    onError: (e) => calls.push({ event: "error", payload: e }),
    onToolStart: (n, t) => calls.push({ event: "toolStart", payload: { n, t } }),
    onToolEnd: (n) => calls.push({ event: "toolEnd", payload: n }),
  };
  return { calls, cb };
}

function makeExecutor(overrides: Partial<ToolExecutor> = {}): ToolExecutor {
  return {
    execute: vi.fn().mockResolvedValue({
      toolCallId: "tc1",
      name: "ping",
      result: "ok",
      displayText: "ping tool",
    }),
    getToolDefinitions: vi.fn().mockReturnValue([]),
    ...overrides,
  } as unknown as ToolExecutor;
}

const scrubberConfig = {
  assistantName: "Assistant",
  enableOutputScrubbing: false,
  blockedOutputPatterns: [],
  systemPromptFragments: [],
};

describe("runAgent", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    // Restore any globally stubbed `fetch` (and other globals) so they
    // don't leak into the next test file that runs in the same worker.
    vi.unstubAllGlobals();
  });

  it("streams a plain response with no tool calls", async () => {
    mockFetch.mockImplementation(
      sseResponseFactory([
        { choices: [{ delta: { content: "Hello " } }] },
        { choices: [{ delta: { content: "world" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]),
    );
    const { calls, cb } = makeCallbacks();
    const exec = makeExecutor();
    const result = await runAgent({
      config: makeConfig(),
      messages: [{ role: "user", content: "hi" }],
      toolExecutor: exec,
      tools: [],
      callbacks: cb,
      scrubberConfig,
    });
    expect(result.content).toBe("Hello world");
    expect(result.toolCallsMade).toBe(0);
    const tokens = calls.filter((c) => c.event === "token").map((c) => c.payload);
    expect(tokens).toEqual(["Hello ", "world"]);
  });

  it("executes a tool call, then re-calls the model and returns the final text", async () => {
    mockFetch
      .mockImplementationOnce(
        sseResponseFactory([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { id: "tc1", index: 0, function: { name: "ping", arguments: "{}" } },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          },
        ]),
      )
      .mockImplementationOnce(
        sseResponseFactory([
          { choices: [{ delta: { content: "After tool" } }] },
          { choices: [{ delta: {}, finish_reason: "stop" }] },
        ]),
      );

    const { calls, cb } = makeCallbacks();
    const exec = makeExecutor({
      execute: vi.fn().mockResolvedValue({
        toolCallId: "tc1",
        name: "ping",
        result: "ok",
        displayText: "ping",
      }),
    });

    const result = await runAgent({
      config: makeConfig(),
      messages: [{ role: "user", content: "do it" }],
      toolExecutor: exec,
      tools: [],
      callbacks: cb,
      scrubberConfig,
    });

    expect(result.content).toBe("After tool");
    expect(result.toolCallsMade).toBe(1);
    expect(exec.execute).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c.event === "toolStart")).toBe(true);
    expect(calls.some((c) => c.event === "toolEnd")).toBe(true);
  });

  it("respects maxToolCalls and stops the loop", async () => {
    // Model keeps requesting the same tool forever; executor always says "ok"
    mockFetch.mockImplementation(
      sseResponseFactory([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { id: "tc1", index: 0, function: { name: "ping", arguments: "{}" } },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        },
      ]),
    );
    const { calls, cb } = makeCallbacks();
    const exec = makeExecutor({
      execute: vi.fn().mockResolvedValue({
        toolCallId: "tc1",
        name: "ping",
        result: "ok",
        displayText: "ping",
      }),
    });
    const result = await runAgent({
      config: makeConfig({ maxToolCalls: 2 }),
      messages: [{ role: "user", content: "x" }],
      toolExecutor: exec,
      tools: [],
      callbacks: cb,
      scrubberConfig,
    });
    expect(exec.execute).toHaveBeenCalledTimes(2);
    expect(result.toolCallsMade).toBe(2);
    expect(calls.some((c) => c.event === "done")).toBe(true);
  });

  it("caps a multi-tool-call response at maxToolCalls and stops the loop", async () => {
    // One model response with TWO tool calls. With maxToolCalls: 1, the
    // executor must run exactly once and the loop must exit. This is
    // the branch the previous "one call per response" test didn't cover.
    mockFetch.mockImplementation(
      sseResponseFactory([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { id: "tc1", index: 0, function: { name: "ping", arguments: "{}" } },
                  { id: "tc2", index: 1, function: { name: "ping", arguments: "{}" } },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        },
      ]),
    );
    const { calls, cb } = makeCallbacks();
    const exec = makeExecutor({
      execute: vi.fn().mockResolvedValue({
        toolCallId: "tc1",
        name: "ping",
        result: "ok",
        displayText: "ping",
      }),
    });
    const result = await runAgent({
      config: makeConfig({ maxToolCalls: 1 }),
      messages: [{ role: "user", content: "do both" }],
      toolExecutor: exec,
      tools: [],
      callbacks: cb,
      scrubberConfig,
    });
    expect(exec.execute).toHaveBeenCalledTimes(1);
    expect(result.toolCallsMade).toBe(1);
    // The done callback fires exactly once on the limit-hit branch.
    expect(calls.filter((c) => c.event === "done")).toHaveLength(1);
  });

  it("surfaces tool errors to the model without crashing", async () => {
    mockFetch
      .mockImplementationOnce(
        sseResponseFactory([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { id: "tc1", index: 0, function: { name: "ping", arguments: "{}" } },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          },
        ]),
      )
      .mockImplementationOnce(
        sseResponseFactory([
          { choices: [{ delta: { content: "Sorry, that failed." } }] },
          { choices: [{ delta: {}, finish_reason: "stop" }] },
        ]),
      );

    const { cb } = makeCallbacks();
    const exec = makeExecutor({
      execute: vi.fn().mockResolvedValue({
        toolCallId: "tc1",
        name: "ping",
        result: "Tool returned error 500: boom",
        displayText: "ping",
      }),
    });
    const result = await runAgent({
      config: makeConfig(),
      messages: [{ role: "user", content: "x" }],
      toolExecutor: exec,
      tools: [],
      callbacks: cb,
      scrubberConfig,
    });
    expect(result.content).toBe("Sorry, that failed.");
  });

  it("fires onError when the provider errors out", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, text: async () => "bad gateway" });
    const { calls, cb } = makeCallbacks();
    const exec = makeExecutor();
    const result = await runAgent({
      config: makeConfig(),
      messages: [{ role: "user", content: "x" }],
      toolExecutor: exec,
      tools: [],
      callbacks: cb,
      scrubberConfig,
    });
    expect(calls.some((c) => c.event === "error")).toBe(true);
    expect(result.content).toBe("");
  });

  it("emits onToken callbacks in order", async () => {
    mockFetch.mockImplementation(
      sseResponseFactory([
        { choices: [{ delta: { content: "one" } }] },
        { choices: [{ delta: { content: " two" } }] },
        { choices: [{ delta: { content: " three" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]),
    );
    const { calls, cb } = makeCallbacks();
    await runAgent({
      config: makeConfig(),
      messages: [{ role: "user", content: "x" }],
      toolExecutor: makeExecutor(),
      tools: [],
      callbacks: cb,
      scrubberConfig,
    });
    const tokens = calls.filter((c) => c.event === "token").map((c) => c.payload);
    expect(tokens).toEqual(["one", " two", " three"]);
  });
});
