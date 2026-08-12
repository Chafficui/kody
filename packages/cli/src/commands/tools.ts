/**
 * `kody tools test` — proxy a tool invocation to the admin test endpoint.
 *
 * The endpoint `POST /api/admin/sites/:siteId/tools/:toolName/test` is the
 * Stream A admin tool test endpoint. This CLI is a thin wrapper that:
 *   - reads the bearer token from --token or env
 *   - POSTs the JSON args
 *   - prints the response (or a friendly error if 404/401/500)
 *
 * If Stream A's endpoint isn't merged yet, the CLI prints a clear
 * "endpoint not available" message instead of a generic 404.
 */
import { closeRl } from "../lib/prompts.js";

interface ToolsTestOptions {
  serverUrl: string;
  token?: string;
  args: string;
}

interface ToolTestResponse {
  ok: boolean;
  result?: unknown;
  error?: { message: string; code?: string };
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Validate the configured server URL before any request is sent so we don't
 * accidentally send a bearer token to a typo'd host or to a non-loopback
 * HTTP endpoint (which would expose the token in plaintext).
 *
 * @throws Error when the URL is missing, malformed, or uses HTTP for a
 *         non-loopback host.
 */
function validateServerUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid --server-url "${rawUrl}". Must be a full URL like http://localhost:3456.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `Invalid --server-url "${rawUrl}". Only http: and https: are supported.`,
    );
  }
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing to send a bearer token over plain HTTP to a non-loopback host "${url.hostname}". Use https:// or http://localhost.`,
    );
  }
  return url;
}

export async function toolsTestCommand(
  siteId: string,
  toolName: string,
  opts: ToolsTestOptions,
): Promise<void> {
  const serverUrl = validateServerUrl(opts.serverUrl).toString().replace(/\/$/, "");
  const token = opts.token ?? process.env.KODY_TOKEN;
  if (!token) {
    throw new Error(
      "Missing admin token. Pass --token <token> or set KODY_TOKEN in the environment.",
    );
  }

  let args: unknown;
  try {
    args = JSON.parse(opts.args);
  } catch (err) {
    throw new Error(`--args is not valid JSON: ${(err as Error).message}`);
  }

  const url = `${serverUrl}/api/admin/sites/${encodeURIComponent(siteId)}/tools/${encodeURIComponent(toolName)}/test`;
  // Timeout covers BOTH the fetch and the response body read. We do the
  // body read inside the same try/finally so the abort timer stays armed
  // until we're done consuming the body.
  const TIMEOUT_MS = 30_000;
  let res: Response;
  let text: string;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ args }),
      signal: ctl.signal,
    });
    text = await res.text();
  } catch (err) {
    throw new Error(`Request to ${url} failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(t);
  }

  let parsed: ToolTestResponse | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as ToolTestResponse;
    } catch {
      // Non-JSON body — surface it as-is.
    }
  }

  if (res.status === 404) {
    console.error(
      `Tool test endpoint not available (HTTP 404). ` +
        `This is expected on older servers — Stream A adds it. ` +
        `Update your server to the latest @kody/server, or run the tool manually.`,
    );
    process.exit(2);
  }
  if (res.status === 401) {
    console.error(
      "Unauthorized: the admin token is invalid or expired. POST /api/admin/login to obtain a fresh token.",
    );
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Tool test failed: HTTP ${res.status}`);
    if (parsed?.error) {
      console.error(`  ${parsed.error.message}`);
    } else {
      console.error(text);
    }
    process.exit(1);
  }

  if (parsed?.ok) {
    console.log("Tool call succeeded.");
    console.log(JSON.stringify(parsed.result, null, 2));
  } else if (parsed && !parsed.ok) {
    console.error("Tool call returned an error:");
    console.error(parsed.error?.message ?? "unknown error");
    process.exit(1);
  } else {
    // Non-JSON success
    console.log(text);
  }
  await closeRl();
}
