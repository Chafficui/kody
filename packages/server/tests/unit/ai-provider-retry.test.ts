import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  streamChatCompletion,
  isRetriableStatus,
  type AiStreamCallbacks,
} from "../../src/services/ai-provider.js";
import type { AiProviderConfig } from "@kody/shared";

/**
 * Tiny helper to build a minimal SSE stream response. The response
 * yields the supplied `lines` joined as `data: <line>\n\n` chunks
 * followed by `data: [DONE]\n\n` (the OpenAI-compatible terminator).
 */
function makeStreamResponse(lines: string[]): Response {
  const payload =
    lines.map((l) => `data: ${l}\n\n`).join("") + "data: [DONE]\n\n";
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body,
    headers: new Headers(),
    text: () => Promise.resolve(payload),
  } as unknown as Response;
}

function makeErrorResponse(status: number, body = "boom", headers: Record<string, string> = {}): Response {
  return {
    ok: false,
    status,
    body: null,
    headers: new Headers(headers),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

function tokenChunk(content: string): string {
  return JSON.stringify({
    choices: [{ delta: { content }, finish_reason: null }],
  });
}

function doneChunk(reason: string): string {
  return JSON.stringify({
    choices: [{ delta: {}, finish_reason: reason }],
  });
}

const baseConfig: AiProviderConfig = {
  baseUrl: "http://localhost:11434/v1",
  apiKey: "ollama",
  model: "llama3.2",
  temperature: 0.7,
  maxTokens: 256,
  retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
};

describe("isRetriableStatus", () => {
  it("treats 429 as retriable", () => {
    expect(isRetriableStatus(429)).toBe(true);
  });
  it("treats 5xx as retriable", () => {
    for (const s of [500, 502, 503, 504, 599]) {
      expect(isRetriableStatus(s)).toBe(true);
    }
  });
  it("does not retry 4xx other than 429", () => {
    for (const s of [400, 401, 403, 404, 422]) {
      expect(isRetriableStatus(s)).toBe(false);
    }
  });
});

describe("streamChatCompletion retry behaviour", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries on 429 and surfaces onRetry", async () => {
    const responses = [
      makeErrorResponse(429, "rate limited", { "Retry-After": "0" }),
      makeErrorResponse(429, "rate limited", { "Retry-After": "0" }),
      makeStreamResponse([tokenChunk("Hello"), doneChunk("stop")]),
    ];
    vi.mocked(fetch)
      .mockResolvedValueOnce(responses[0]!)
      .mockResolvedValueOnce(responses[1]!)
      .mockResolvedValueOnce(responses[2]!);

    const onRetry = vi.fn();
    const cb: AiStreamCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onRetry,
    };
    const result = await streamChatCompletion(baseConfig, [{ role: "user", content: "hi" }], cb);

    expect(result.content).toBe("Hello");
    expect(result.finishReason).toBe("stop");
    expect(cb.onError).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("retries on 503 server error", async () => {
    const responses = [
      makeErrorResponse(503, "Service Unavailable"),
      makeStreamResponse([tokenChunk("OK"), doneChunk("stop")]),
    ];
    vi.mocked(fetch)
      .mockResolvedValueOnce(responses[0]!)
      .mockResolvedValueOnce(responses[1]!);

    const onRetry = vi.fn();
    const cb: AiStreamCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onRetry,
    };
    const result = await streamChatCompletion(baseConfig, [{ role: "user", content: "hi" }], cb);

    expect(result.content).toBe("OK");
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400/401/404/422 client errors", async () => {
    for (const status of [400, 401, 403, 404, 422]) {
      vi.mocked(fetch).mockReset();
      vi.mocked(fetch).mockResolvedValue(makeErrorResponse(status, "bad"));
      const onError = vi.fn();
      const cb: AiStreamCallbacks = {
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError,
      };
      const result = await streamChatCompletion(
        baseConfig,
        [{ role: "user", content: "hi" }],
        cb,
      );
      expect(result.finishReason).toBe("error");
      expect(onError).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up after maxAttempts and calls onError", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(502, "Bad Gateway"));
    const onError = vi.fn();
    const onRetry = vi.fn();
    const cb: AiStreamCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError,
      onRetry,
    };
    const result = await streamChatCompletion(
      { ...baseConfig, retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 } },
      [{ role: "user", content: "hi" }],
      cb,
    );

    expect(result.finishReason).toBe("error");
    expect(result.content).toBe("");
    expect(onError).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledTimes(2); // attempts 1 and 2 trigger a retry; attempt 3 gives up
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("respects Retry-After on 429 and reports the delay in onRetry", async () => {
    // The Retry-After header is delta-seconds per RFC 9110.
    // "0.05" is not a valid integer-seconds value (and would
    // also depend on the provider rounding sub-second delays
    // in a way the client can't predict), so use a valid
    // integer-seconds value and fake timers to advance past
    // the sleep without blocking the test runner.
    vi.useFakeTimers();
    try {
      vi.mocked(fetch)
        .mockResolvedValueOnce(makeErrorResponse(429, "rl", { "Retry-After": "1" }))
        .mockResolvedValueOnce(makeStreamResponse([tokenChunk("Hi"), doneChunk("stop")]));

      const onRetry = vi.fn();
      const cb: AiStreamCallbacks = {
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
        onRetry,
      };
      // `setTimeout` inside the sleep helper is replaced by
      // vi's fake timers when the call starts, so we can
      // resolve the awaited promise by advancing the clock
      // past the Retry-After delay.
      const pending = streamChatCompletion(
        { ...baseConfig, retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 } },
        [{ role: "user", content: "hi" }],
        cb,
      );
      // Let the in-flight fetch return and the route compute
      // the Retry-After delay, then advance time past the
      // sleep so the retry fetch can run.
      await vi.advanceTimersByTimeAsync(1000);
      const result = await pending;

      expect(result.content).toBe("Hi");
      expect(onRetry).toHaveBeenCalledTimes(1);
      const call = onRetry.mock.calls[0]?.[0] as { delayMs: number; reason: string };
      // Retry-After: 1s -> 1000ms (the parseRetryAfter helper
      // multiplies by 1000 and caps at 60_000).
      expect(call.delayMs).toBe(1000);
      expect(call.reason).toContain("429");
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries when fetch throws a network error", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(makeStreamResponse([tokenChunk("Recovered"), doneChunk("stop")]));

    const onError = vi.fn();
    const onRetry = vi.fn();
    const cb: AiStreamCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError,
      onRetry,
    };
    const result = await streamChatCompletion(
      { ...baseConfig, retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 } },
      [{ role: "user", content: "hi" }],
      cb,
    );

    expect(result.content).toBe("Recovered");
    expect(onError).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts retrying when the user signal aborts", async () => {
    const ac = new AbortController();
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((_, reject) => {
        ac.signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
    );

    const onError = vi.fn();
    const cb: AiStreamCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError,
    };
    const promise = streamChatCompletion(
      { ...baseConfig, retry: { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 1 } },
      [{ role: "user", content: "hi" }],
      cb,
      { signal: ac.signal },
    );
    ac.abort();
    const result = await promise;

    expect(result.finishReason).toBe("error");
    expect(onError).toHaveBeenCalled();
  });

  it("succeeds on the first try without invoking onRetry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeStreamResponse([tokenChunk("Direct"), doneChunk("stop")]),
    );
    const onRetry = vi.fn();
    const cb: AiStreamCallbacks = {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onRetry,
    };
    const result = await streamChatCompletion(baseConfig, [{ role: "user", content: "hi" }], cb);
    expect(result.content).toBe("Direct");
    expect(onRetry).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
