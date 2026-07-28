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

export async function toolsTestCommand(
  siteId: string,
  toolName: string,
  opts: ToolsTestOptions,
): Promise<void> {
  const serverUrl = opts.serverUrl.replace(/\/$/, "");
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
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30_000);
  let res: Response;
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
  } catch (err) {
    throw new Error(`Request to ${url} failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
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
    console.error("Unauthorized: the admin token is invalid or expired. Re-run `kody init` or POST /api/admin/login.");
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
