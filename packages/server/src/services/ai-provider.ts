import { createHash } from "node:crypto";
import type { AiProviderConfig } from "@kody/shared";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallRequest {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface AiStreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onRetry?: (info: { attempt: number; delayMs: number; reason: string }) => void;
}

export interface AiStreamResult {
  content: string;
  toolCalls: ToolCallRequest[];
  finishReason: string;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Determine whether a given HTTP status code should be retried.
 * 429 (rate-limited) and 5xx server errors are retriable; client
 * errors (4xx other than 429) are NOT — they will never succeed.
 */
export function isRetriableStatus(status: number): boolean {
  if (status === 429) return true;
  return status >= 500 && status <= 599;
}

/**
 * Parse a Retry-After header (seconds) into a millisecond delay.
 * Falls back to 0 if the header is missing or unparseable.
 */
function parseRetryAfter(value: string | null | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const trimmed = value.trim();
  if (!trimmed) return fallbackMs;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 60_000);
  }
  // HTTP-date form is rarely used by AI providers; treat as fallback.
  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) {
    return Math.max(0, Math.min(date - Date.now(), 60_000));
  }
  return fallbackMs;
}

/**
 * Compute the backoff delay for a given attempt using truncated
 * exponential backoff with a small jitter envelope. `attempt` is
 * 1-based: attempt 1 returns ~baseDelayMs.
 */
function computeBackoff(attempt: number, opts: RetryOptions): number {
  const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * Math.pow(2, attempt - 1));
  const jitter = 0.25 * exp * Math.random();
  return Math.min(opts.maxDelayMs, Math.floor(exp + jitter));
}

/**
 * Default retry policy used when the site config doesn't override it.
 * Matches the brief: 3 attempts, base 200ms, capped at 2s.
 */
export const DEFAULT_RETRY: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2000,
};

/**
 * Merge a per-call `RetryOptions` with the site-level config. Always
 * caps `maxAttempts` at 1 to disable retries if the caller asks.
 */
function resolveRetry(config: AiProviderConfig): Required<RetryOptions> {
  const r = config.retry ?? {};
  return {
    maxAttempts: Math.max(1, r.maxAttempts ?? DEFAULT_RETRY.maxAttempts),
    baseDelayMs: r.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs,
    maxDelayMs: r.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs,
  };
}

const MAX_CONSECUTIVE_BAD_CHUNKS = 25;

export async function streamChatCompletion(
  config: AiProviderConfig,
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }>,
  callbacks: AiStreamCallbacks,
  options?: { tools?: ToolDefinition[]; signal?: AbortSignal },
): Promise<AiStreamResult> {
  const retry = resolveRetry(config);
  const body = buildRequestBody(config, messages, options?.tools);

  let attempt = 0;
  let lastStatus = 0;
  let lastError = "";
  let consecutiveBad = 0;

  // Try up to `retry.maxAttempts` times. Each attempt either streams
  // to completion, returns a client error (no retry), or surfaces a
  // retriable failure. We rebuild the body fresh each attempt.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        callbacks.onError("aborted");
        return { content: "", toolCalls: [], finishReason: "error" };
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    let response: Response;
    try {
      response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      options?.signal?.removeEventListener("abort", onAbort);
      const message = err instanceof Error ? err.message : "Failed to connect to AI provider";
      lastError = message;
      if (attempt < retry.maxAttempts && !isAbortError(err)) {
        const delay = computeBackoff(attempt, retry);
        callbacks.onRetry?.({ attempt, delayMs: delay, reason: `network: ${message}` });
        await sleep(delay, options?.signal);
        continue;
      }
      callbacks.onError(message);
      return { content: "", toolCalls: [], finishReason: "error" };
    }

    if (!response.ok) {
      options?.signal?.removeEventListener("abort", onAbort);
      const status = response.status;
      lastStatus = status;
      const text = await response.text().catch(() => "Unknown error");
      lastError = `AI provider returned ${status}: ${text.slice(0, 500)}`;

      if (!isRetriableStatus(status) || attempt >= retry.maxAttempts) {
        callbacks.onError(lastError);
        return { content: "", toolCalls: [], finishReason: "error" };
      }
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"), computeBackoff(attempt, retry));
      const delay = retryAfter;
      callbacks.onRetry?.({ attempt, delayMs: delay, reason: `status ${status}` });
      try {
        await response.body?.cancel();
      } catch {
        // best effort
      }
      await sleep(delay, options?.signal);
      continue;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      options?.signal?.removeEventListener("abort", onAbort);
      callbacks.onError("No response body from AI provider");
      return { content: "", toolCalls: [], finishReason: "error" };
    }

    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";
    let finishReason = "stop";
    const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();
    let streamError: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") {
            if (trimmed === "data: [DONE]") {
              const toolCalls = buildToolCalls(toolCallAccumulator);
              callbacks.onDone();
              return { content: fullContent, toolCalls, finishReason };
            }
            continue;
          }

          if (!trimmed.startsWith("data: ")) continue;

          let json: unknown;
          try {
            json = JSON.parse(trimmed.slice(6));
            consecutiveBad = 0;
          } catch {
            consecutiveBad++;
            if (consecutiveBad >= MAX_CONSECUTIVE_BAD_CHUNKS) {
              streamError = `AI stream desync: ${consecutiveBad} consecutive malformed chunks; aborting`;
              break;
            }
            continue;
          }

          const choice = (json as { choices?: Array<{ delta?: unknown; finish_reason?: string }> })
            .choices?.[0];
          if (!choice) continue;

          const delta = choice.delta as
            | { content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> }
            | undefined;

          if (delta?.content) {
            fullContent += delta.content;
            callbacks.onToken(delta.content);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallAccumulator.has(idx)) {
                toolCallAccumulator.set(idx, {
                  id: tc.id ?? "",
                  name: tc.function?.name ?? "",
                  arguments: "",
                });
              }
              const acc = toolCallAccumulator.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments) acc.arguments += tc.function.arguments;
            }
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
            if (choice.finish_reason === "stop" || choice.finish_reason === "tool_calls") {
              const toolCalls = buildToolCalls(toolCallAccumulator);
              callbacks.onDone();
              return { content: fullContent, toolCalls, finishReason };
            }
          }
        }

        if (streamError) break;
      }
    } catch (err) {
      options?.signal?.removeEventListener("abort", onAbort);
      const message = err instanceof Error ? err.message : "Stream read error";
      streamError = message;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
      options?.signal?.removeEventListener("abort", onAbort);
    }

    if (streamError) {
      // Decide: retry the whole stream or fail. Network mid-stream failures
      // are retriable; the desync guard is not (it indicates a broken
      // provider, not a flaky network).
      const isDesync = streamError.startsWith("AI stream desync");
      if (!isDesync && attempt < retry.maxAttempts) {
        lastError = streamError;
        const delay = computeBackoff(attempt, retry);
        callbacks.onRetry?.({ attempt, delayMs: delay, reason: `stream: ${streamError}` });
        await sleep(delay, options?.signal);
        continue;
      }
      callbacks.onError(streamError);
      return { content: "", toolCalls: [], finishReason: "error" };
    }

    const toolCalls = buildToolCalls(toolCallAccumulator);
    callbacks.onDone();
    return { content: fullContent, toolCalls, finishReason };
  }

  // Unreachable; the loop either returns or continues.
  callbacks.onError(lastError || `AI provider failed (last status ${lastStatus})`);
  return { content: "", toolCalls: [], finishReason: "error" };
}

function buildHeaders(config: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey && config.apiKey !== "ollama") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  return headers;
}

function buildRequestBody(
  config: AiProviderConfig,
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }>,
  tools?: ToolDefinition[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    ...(config.topP !== undefined ? { top_p: config.topP } : {}),
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }
  return body;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function buildToolCalls(
  acc: Map<number, { id: string; name: string; arguments: string }>,
): ToolCallRequest[] {
  if (acc.size === 0) return [];
  return Array.from(acc.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => ({
      id: v.id,
      function: { name: v.name, arguments: v.arguments },
    }));
}

/**
 * Compute a SHA-256 hash of a normalized request shape. Used by the
 * response cache to build a stable key from the conversation slice.
 * Exported for tests.
 */
export function hashRequest(parts: Array<string | number | undefined | null>): string {
  const h = createHash("sha256");
  for (const p of parts) {
    h.update(String(p ?? ""));
    h.update("\u0000");
  }
  return h.digest("hex");
}
