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

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkHealth(serverUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(`${serverUrl}/health`);
    if (res.status !== 200) {
      return { name: "health", status: "fail", detail: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { status?: string };
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
  try {
    const res = await timedFetch(`${serverUrl}/api/config/${siteId}`);
    if (res.status === 200) {
      return { name: "config", status: "ok", detail: `site "${siteId}" returns a config` };
    }
    if (res.status === 404) {
      return { name: "config", status: "fail", detail: `site "${siteId}" not found` };
    }
    return { name: "config", status: "fail", detail: `HTTP ${res.status}` };
  } catch (err) {
    return { name: "config", status: "fail", detail: (err as Error).message };
  }
}

async function checkOpenApi(serverUrl: string): Promise<CheckResult> {
  try {
    const res = await timedFetch(`${serverUrl}/openapi.yaml`);
    if (res.status !== 200) {
      return { name: "openapi", status: "fail", detail: `HTTP ${res.status}` };
    }
    const text = await res.text();
    if (!text.startsWith("openapi:") && !text.startsWith("openapi ")) {
      return { name: "openapi", status: "warn", detail: "200 but body doesn't look like an OpenAPI document" };
    }
    return { name: "openapi", status: "ok", detail: `spec served (${text.length} bytes)` };
  } catch (err) {
    return { name: "openapi", status: "fail", detail: (err as Error).message };
  }
}

async function checkWidgetAsset(serverUrl: string): Promise<CheckResult> {
  // The widget IIFE is the thing end-users actually load. Make sure the
  // server is serving it.
  try {
    const res = await timedFetch(`${serverUrl}/widget.js`, { method: "HEAD" });
    if (res.status !== 200) {
      return { name: "widget.js", status: "fail", detail: `HTTP ${res.status}` };
    }
    return { name: "widget.js", status: "ok", detail: "served" };
  } catch (err) {
    return { name: "widget.js", status: "fail", detail: (err as Error).message };
  }
}

export async function doctorCommand(opts: DoctorOptions): Promise<void> {
  const serverUrl = opts.serverUrl.replace(/\/$/, "");
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
