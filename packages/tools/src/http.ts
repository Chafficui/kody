/**
 * Low-level HTTP helper used by every pre-built tool.
 *
 * Handles:
 *   - JSON request bodies (auto Content-Type)
 *   - AbortController-based timeouts
 *   - Exponential backoff retries on transient errors
 *   - Optional HMAC-SHA256 body signing
 *   - Bearer or named-header auth
 *
 * The helper is transport-agnostic: callers wrap it with their own URL and
 * parameter mapping to build higher-level tools (webhook, slack, etc.).
 */

import { createHmac } from "node:crypto";

export interface HttpCallOptions {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  /** JSON-encodable body. For GET requests this is sent as a query string. */
  body?: unknown;
  /** Per-request timeout in milliseconds. Defaults to 10_000. */
  timeoutMs?: number;
  /** Optional HMAC secret; if set, the body is signed and a `X-Kody-Signature` header is added. */
  secret?: string;
  /** Optional auth: bearer adds Authorization header, apiKey adds the named header. */
  auth?: { type: "bearer" | "apiKey"; value: string; headerName?: string };
  /** Optional retry policy. Defaults to no retries. */
  retry?: { maxAttempts: number; baseDelayMs: number };
  /** Custom fetch (for tests). */
  fetchImpl?: typeof fetch;
}

export interface HttpCallResult {
  status: number;
  ok: boolean;
  /** Raw text body. */
  text: string;
  /** Parsed JSON, or null if the body is not JSON. */
  json: unknown;
}

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true; // network failure
  return false;
}

/**
 * Perform an HTTP request. Returns a structured result on every outcome.
 * Never throws for HTTP-level failures; only throws for programmer errors.
 */
export async function httpCall(options: HttpCallOptions): Promise<HttpCallResult> {
  const { url, method, body, timeoutMs = 10_000, secret, auth, retry, headers = {}, fetchImpl } =
    options;
  const fetcher = fetchImpl ?? fetch;
  const maxAttempts = retry?.maxAttempts ?? 1;
  const baseDelay = retry?.baseDelayMs ?? 250;

  // Build the final URL, serialising JSON body as query params for GET/DELETE.
  let finalUrl = url;
  let bodyText: string | undefined;
  if (body !== undefined && method !== "GET" && method !== "DELETE") {
    bodyText = JSON.stringify(body);
  } else if (body !== undefined && (method === "GET" || method === "DELETE")) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) finalUrl = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
  }

  const baseHeaders: Record<string, string> = { ...headers };
  if (bodyText !== undefined) baseHeaders["Content-Type"] = "application/json";
  if (secret && bodyText !== undefined) {
    baseHeaders["X-Kody-Signature"] = createHmac("sha256", secret).update(bodyText).digest("hex");
  }
  if (auth) {
    if (auth.type === "bearer") {
      baseHeaders["Authorization"] = `Bearer ${auth.value}`;
    } else {
      const name = auth.headerName ?? "Authorization";
      baseHeaders[name] = auth.value;
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(finalUrl, {
        method,
        headers: baseHeaders,
        body: bodyText,
        signal: controller.signal,
      });
      const text =
        typeof response?.text === "function"
          ? await response.text().catch(() => "")
          : "";
      clearTimeout(timer);

      let json: unknown = null;
      if (text.length > 0) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }

      if (!response.ok && TRANSIENT_STATUS.has(response.status) && attempt < maxAttempts) {
        await sleep(baseDelay * 2 ** (attempt - 1));
        continue;
      }

      return { status: response.status, ok: response.ok, text, json };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < maxAttempts && isRetryable(err)) {
        await sleep(baseDelay * 2 ** (attempt - 1));
        continue;
      }
      const message = err instanceof Error ? err.message : "Unknown network error";
      // Surface as a 0-status result rather than throwing — matches the
      // existing ToolExecutor contract (never throw from a tool).
      return { status: 0, ok: false, text: `Network error: ${message}`, json: null };
    }
  }

  // Unreachable in practice — the loop above either returns or returns the
  // network-error result. Defensive fallback:
  const message = lastError instanceof Error ? lastError.message : "Retries exhausted";
  return { status: 0, ok: false, text: `Network error: ${message}`, json: null };
}

/** Convenience: extract a value at a dotted JSON path. Returns the fallback when any segment is missing. */
export function pluckPath(value: unknown, path: string, fallback?: unknown): unknown {
  if (!path) return value;
  const segments = path.split(".");
  let current: unknown = value;
  for (const seg of segments) {
    if (current === null || typeof current !== "object") return fallback;
    current = (current as Record<string, unknown>)[seg];
  }
  return current === undefined ? fallback : current;
}
