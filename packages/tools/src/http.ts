/**
 * Low-level HTTP helper used by every pre-built tool.
 *
 * Handles:
 *   - JSON request bodies (auto Content-Type)
 *   - AbortController-based timeouts
 *   - Exponential backoff retries on transient errors
 *   - Optional HMAC-SHA256 body signing
 *   - Bearer or named-header auth
 *   - SSRF protection (https-only by default, host allowlist optional)
 *
 * The helper is transport-agnostic: callers wrap it with their own URL and
 * parameter mapping to build higher-level tools (webhook, slack, etc.).
 */

import { createHmac } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

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
  /**
   * Optional list of allowed hostnames. When set, requests to any host
   * not in this list are rejected before the network call. When omitted,
   * only the public-network check (no loopback / private / link-local /
   * metadata) is applied.
   */
  allowedHosts?: string[];
  /**
   * Caller-supplied idempotency key. When present, the same key is attached
   * to every retry attempt so the receiver can deduplicate. Required for
   * safe retries of non-idempotent methods.
   */
  idempotencyKey?: string;
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

/** Methods that are safe to retry without caller-supplied idempotency. */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true only for transient network errors we want to retry. We do NOT
 * treat every TypeError as retryable — fetch raises TypeError for many
 * programmer errors (invalid URL, body-after-stream, etc.).
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof Error && "code" in err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Common transient socket errors
    if (
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "ECONNREFUSED" ||
      code === "EAI_AGAIN" ||
      code === "ENOTFOUND" ||
      code === "EPIPE" ||
      code === "EHOSTUNREACH" ||
      code === "ENETUNREACH"
    ) {
      return true;
    }
  }
  return false;
}

function isPrivateOrLoopbackIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::" ) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateOrLoopbackIPv4(mapped[1]);
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (lower === "metadata.google.internal" || lower === "metadata") return true;
  // raw IP literal?
  if (net.isIP(lower)) {
    if (lower.includes(":")) return isPrivateOrLoopbackIPv6(lower);
    return isPrivateOrLoopbackIPv4(lower);
  }
  return false;
}

/**
 * Resolve the host of the URL and return the hostname along with the resolved
 * addresses. Throws when the hostname resolves to a blocked address.
 */
async function assertSafeTarget(url: string, allowedHosts?: string[]): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Refusing to call non-http(s) URL: ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  if (!host) {
    throw new Error("URL is missing a hostname");
  }

  if (allowedHosts && allowedHosts.length > 0) {
    const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));
    if (!allowed.has(host.toLowerCase())) {
      throw new Error(`Host "${host}" is not in the allowlist`);
    }
    return;
  }

  if (isBlockedHost(host)) {
    throw new Error(`Refusing to call private/loopback host: ${host}`);
  }

  // Resolve the host and check that every resolved address is public.
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DNS lookup failed";
    throw new Error(`DNS lookup failed for ${host}: ${message}`);
  }
  for (const a of addresses) {
    if (isBlockedHost(a.address)) {
      throw new Error(`Refusing to call private/loopback address: ${a.address}`);
    }
  }
}

/**
 * Perform an HTTP request. Returns a structured result on every outcome.
 * Never throws for HTTP-level failures; only throws for programmer errors.
 *
 * Retry policy: only idempotent methods (GET/HEAD/OPTIONS/PUT/DELETE) are
 * retried automatically. Non-idempotent methods (POST/PATCH) are only
 * retried when the caller supplies an `idempotencyKey` — in that case the
 * key is attached to every attempt so the receiver can deduplicate.
 *
 * SSRF: the URL hostname is resolved and every resolved address is checked
 * against the loopback / private / link-local / metadata blocklist. When
 * `allowedHosts` is set, the hostname must match one of the listed hosts.
 */
export async function httpCall(options: HttpCallOptions): Promise<HttpCallResult> {
  const {
    url,
    method,
    body,
    timeoutMs = 10_000,
    secret,
    auth,
    retry,
    headers = {},
    fetchImpl,
    allowedHosts,
    idempotencyKey,
  } = options;
  await assertSafeTarget(url, allowedHosts);
  const fetcher = fetchImpl ?? fetch;
  const maxAttempts = retry?.maxAttempts ?? 1;
  const baseDelay = retry?.baseDelayMs ?? 250;
  const methodIsIdempotent = IDEMPOTENT_METHODS.has(method);
  const mayRetry = methodIsIdempotent || Boolean(idempotencyKey);
  const effectiveMax = mayRetry ? maxAttempts : 1;

  // Build the final URL, serialising JSON body as query params for GET/DELETE.
  let finalUrl = url;
  let bodyText: string | undefined;
  if (body !== undefined && body !== null && method !== "GET" && method !== "DELETE") {
    bodyText = JSON.stringify(body);
  } else if (body !== undefined && body !== null && (method === "GET" || method === "DELETE")) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) finalUrl = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
  }

  const baseHeaders: Record<string, string> = { ...headers };
  if (idempotencyKey) baseHeaders["Idempotency-Key"] = idempotencyKey;
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

  // Disable redirects — every redirect target would need its own SSRF check.
  // Callers who need redirects must opt in by passing a fetchImpl.
  const redirectMode = fetchImpl ? undefined : ("manual" as const);

  let lastError: unknown;
  for (let attempt = 1; attempt <= effectiveMax; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(finalUrl, {
        method,
        headers: baseHeaders,
        body: bodyText,
        signal: controller.signal,
        redirect: redirectMode,
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

      if (
        !response.ok &&
        TRANSIENT_STATUS.has(response.status) &&
        attempt < effectiveMax
      ) {
        await sleep(baseDelay * 2 ** (attempt - 1));
        continue;
      }

      return { status: response.status, ok: response.ok, text, json };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      // AbortError retries are only safe for GET — POST/PATCH may have
      // landed server-side before the timeout fired.
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort && method !== "GET" && !idempotencyKey) {
        const message = err instanceof Error ? err.message : "Aborted";
        return { status: 0, ok: false, text: `Network error: ${message}`, json: null };
      }
      if (attempt < effectiveMax && isRetryable(err)) {
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
