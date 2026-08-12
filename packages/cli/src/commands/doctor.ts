/**
 * `kody doctor` — health-check a running Kody server.
 *
 * Runs four checks and prints a human report (or `--json` for scripting):
 *   1. /health responds 200
 *   2. (optional) /api/config/{siteId} returns a config
 *   3. /openapi.yaml is reachable
 *   4. /widget.js is being served (this is what the embed script loads)
 *
 * Returns exit 0 on full health, 1 if any check fails. The CLI is
 * deliberately simple — it does NOT try to talk to the AI provider because
 * that requires real credentials. Provider reachability is documented as
 * out of scope and pointed at the admin UI.
 */
import { closeRl } from "../lib/prompts.js";

interface DoctorOptions {
  serverUrl: string;
  siteId?: string;
  json?: boolean;
}

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

const TIMEOUT_MS = 5000;

/**
 * Run `body` under an AbortController that fires after `ms` milliseconds.
 * The timer is cleared only after `body` resolves, so the timeout covers
 * the full operation — including any response-body reads the caller does.
 *
 * @param ms   Total budget in milliseconds (covers fetch + body).
 * @param body Async function receiving the controller so it can pass the
 *             signal into fetch().
 */
async function withTimeout<T>(ms: number, body: (ctl: AbortController) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await body(ctl);
  } finally {
    clearTimeout(t);
  }
}

async function checkHealth(serverUrl: string): Promise<CheckResult> {
  try {
    const body = (await withTimeout(TIMEOUT_MS, async (ctl) => {
      const res = await fetch(`${serverUrl}/health`, { signal: ctl.signal });
      if (res.status !== 200) {
        return { __nonOk: res.status } as const;
      }
      return (await res.json()) as { status?: string };
    })) as { status?: string } | { __nonOk: number };
    if ("__nonOk" in body) {
      return { name: "health", status: "fail", detail: `HTTP ${body.__nonOk}` };
    }
    if (body.status !== "ok") {
      return { name: "health", status: "warn", detail: `unexpected body: ${JSON.stringify(body)}` };
    }
    return { name: "health", status: "ok", detail: "Server responds 200 with status:ok" };
  } catch (err) {
    return { name: "health", status: "fail", detail: (err as Error).message };
  }
}

async function checkConfig(serverUrl: string, siteId: string | undefined): Promise<CheckResult> {
  if (!siteId) {
    return { name: "config", status: "warn", detail: "skipped (pass --site-id to check a specific site)" };
  }
  // URL-encode the path segment so unusual site ids (rare, but allowed)
  // can't break the URL or accidentally introduce query parameters.
  const safeSiteId = encodeURIComponent(siteId);
  try {
    const status = await withTimeout(TIMEOUT_MS, async (ctl) => {
      const res = await fetch(`${serverUrl}/api/config/${safeSiteId}`, { signal: ctl.signal });
      return res.status;
    });
    if (status === 200) {
      return { name: "config", status: "ok", detail: `site "${siteId}" returns a config` };
    }
    if (status === 404) {
      return { name: "config", status: "fail", detail: `site "${siteId}" not found` };
    }
    return { name: "config", status: "fail", detail: `HTTP ${status}` };
  } catch (err) {
    return { name: "config", status: "fail", detail: (err as Error).message };
  }
}

async function checkOpenApi(serverUrl: string): Promise<CheckResult> {
  try {
    const result = await withTimeout(TIMEOUT_MS, async (ctl) => {
      const res = await fetch(`${serverUrl}/openapi.yaml`, { signal: ctl.signal });
      if (res.status !== 200) {
        return { __nonOk: res.status } as const;
      }
      return { text: await res.text() } as const;
    });
    if ("__nonOk" in result) {
      return { name: "openapi", status: "fail", detail: `HTTP ${result.__nonOk}` };
    }
    if (!result.text.startsWith("openapi:") && !result.text.startsWith("openapi ")) {
      return { name: "openapi", status: "warn", detail: "200 but body doesn't look like an OpenAPI document" };
    }
    return { name: "openapi", status: "ok", detail: `spec served (${result.text.length} bytes)` };
  } catch (err) {
    return { name: "openapi", status: "fail", detail: (err as Error).message };
  }
}

async function checkWidgetAsset(serverUrl: string): Promise<CheckResult> {
  // The widget IIFE is the thing end-users actually load. Make sure the
  // server is serving it.
  try {
    const status = await withTimeout(TIMEOUT_MS, async (ctl) => {
      const res = await fetch(`${serverUrl}/widget.js`, { method: "HEAD", signal: ctl.signal });
      return res.status;
    });
    if (status !== 200) {
      return { name: "widget.js", status: "fail", detail: `HTTP ${status}` };
    }
    return { name: "widget.js", status: "ok", detail: "served" };
  } catch (err) {
    return { name: "widget.js", status: "fail", detail: (err as Error).message };
  }
}

export async function doctorCommand(opts: DoctorOptions): Promise<void> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(opts.serverUrl);
  } catch {
    throw new Error(`Invalid --server-url "${opts.serverUrl}". Must be a full URL like http://localhost:3456.`);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(
      `Invalid --server-url "${opts.serverUrl}". Only http: and https: are supported.`,
    );
  }
  const serverUrl = parsedUrl.toString().replace(/\/$/, "");
  const checks: CheckResult[] = [];

  checks.push(await checkHealth(serverUrl));
  checks.push(await checkConfig(serverUrl, opts.siteId));
  checks.push(await checkOpenApi(serverUrl));
  checks.push(await checkWidgetAsset(serverUrl));

  await closeRl();

  if (opts.json) {
    const summary = {
      server: serverUrl,
      timestamp: new Date().toISOString(),
      overall: checks.every((c) => c.status !== "fail") ? "ok" : "degraded",
      checks,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (summary.overall === "degraded") process.exit(1);
    return;
  }

  const icon: Record<CheckResult["status"], string> = { ok: "✔", warn: "⚠", fail: "✘" };
  for (const c of checks) {
    console.log(`  ${icon[c.status]} ${c.name.padEnd(12)} ${c.detail}`);
  }
  const failed = checks.filter((c) => c.status === "fail");
  if (failed.length === 0) {
    console.log("");
    console.log("All checks passed. Kody is healthy.");
  } else {
    console.log("");
    console.log(`${failed.length} check(s) failed. See above.`);
    process.exit(1);
  }
}
