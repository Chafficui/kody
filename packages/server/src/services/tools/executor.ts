import type { SiteConfig, CustomTool } from "@kody/shared";
import type { ToolCallRequest, ToolDefinition } from "../ai-provider.js";
import type { KnowledgeRetriever } from "../knowledge/retriever.js";
import { getBuiltinToolDefinitions, executeBuiltinTool } from "./builtin.js";
import type { ToolJobStore } from "../tool-job-store.js";

const BUILTIN_TOOL_NAMES = new Set(["knowledge_search", "create_ticket"]);

export interface AsyncToolResult {
  jobId: string;
  /** Polling URL the agent should GET to check job status. */
  pollUrl?: string;
  /** The display text shown while the job is in flight. */
  displayText: string;
  /** Initial tool status from the endpoint (typically "pending" or "running"). */
  initialStatus: "pending" | "running";
}

export interface ToolCallResult {
  toolCallId: string;
  name: string;
  result: string;
  displayText: string;
  /**
   * Set when the custom tool is configured for async execution and the
   * endpoint returned a 202 with a jobId. The agent loop uses this to
   * know it should poll the job URL before continuing.
   */
  async?: AsyncToolResult;
}

interface AsyncDispatchResponse {
  jobId?: string;
  pollUrl?: string;
  status?: string;
  result?: string;
}

export class ToolExecutor {
  constructor(
    private retriever: KnowledgeRetriever | null,
    private toolJobStore?: ToolJobStore,
  ) {}

  getToolDefinitions(config: SiteConfig): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    tools.push(...getBuiltinToolDefinitions(config));

    for (const custom of config.tools.customTools) {
      tools.push({
        type: "function",
        function: {
          name: custom.name,
          description: custom.description,
          parameters: custom.parameters as Record<string, unknown>,
        },
      });
    }

    return tools;
  }

  async execute(
    call: ToolCallRequest,
    config: SiteConfig,
    options?: { sessionId?: string },
  ): Promise<ToolCallResult> {
    const name = call.function.name;

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      return {
        toolCallId: call.id,
        name,
        result: "Invalid arguments: failed to parse JSON",
        displayText: `Running ${name}...`,
      };
    }

    if (BUILTIN_TOOL_NAMES.has(name)) {
      const { result, displayText } = await executeBuiltinTool(
        name,
        args,
        config,
        this.retriever,
      );
      return { toolCallId: call.id, name, result, displayText };
    }

    const customTool = config.tools.customTools.find((t) => t.name === name);
    if (!customTool) {
      return {
        toolCallId: call.id,
        name,
        result: `Unknown tool: ${name}`,
        displayText: `Running ${name}...`,
      };
    }

    if (customTool.endpoint.async) {
      return this.executeAsyncCustomTool(call.id, customTool, args, config, options?.sessionId);
    }

    return this.executeCustomTool(call.id, customTool, args);
  }

  private async executeCustomTool(
    callId: string,
    tool: CustomTool,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const { endpoint } = tool;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpoint.timeoutMs);

    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        // Spread configured headers first so the required
        // Content-Type marker can't be overridden by an operator
        // who misconfigures the tool.
        headers: {
          ...endpoint.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool: tool.name, arguments: args }),
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) {
        return {
          toolCallId: callId,
          name: tool.name,
          result: `Tool returned error ${response.status}: ${text.slice(0, 500)}`,
          displayText: tool.description.slice(0, 50),
        };
      }

      return {
        toolCallId: callId,
        name: tool.name,
        result: text.slice(0, 10000),
        displayText: tool.description.slice(0, 50),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        toolCallId: callId,
        name: tool.name,
        result: `Tool execution failed: ${message}`,
        displayText: tool.description.slice(0, 50),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Dispatch an async custom tool. The endpoint is POSTed with the
   * `X-Kody-Async: true` header so it knows to either return a quick
   * result (200) or a 202 with `{ jobId, pollUrl }`. We persist a
   * `tool_jobs` row regardless so the GET /api/tool-jobs/:jobId
   * endpoint can look it up.
   */
  private async executeAsyncCustomTool(
    callId: string,
    tool: CustomTool,
    args: Record<string, unknown>,
    config: SiteConfig,
    sessionId?: string,
  ): Promise<ToolCallResult> {
    const { endpoint } = tool;

    // Refuse to dispatch (or accept a fallback pollUrl for) an
    // async tool whose configured endpoint is not on a TLS origin.
    // The dispatch request carries operator-configured headers
    // and tool arguments, so a cleartext transport would put
    // both on the wire unencrypted. `endpoint.asyncPollUrl`
    // isn't fetched here, but it is the canonical fallback for
    // the polling path (see the agent module), so we validate
    // it now: an unencrypted fallback that *would* be used
    // later is just as much of a leak as an unencrypted
    // dispatch. HTTP is only acceptable for loopback hosts
    // (localhost / *.localhost / 127.0.0.0/8 / ::1) so an
    // operator can wire a self-hosted tool to `http://localhost`
    // in development without opening every public endpoint to
    // cleartext.
    //
    // The validation runs BEFORE we create the AbortController
    // and the dispatch timeout. A rejected dispatch previously
    // returned past the `setTimeout` call with a live timer
    // outstanding; the timer kept the event loop referenced
    // and later aborted an unused controller.
    const dispatchUrlError = insecureEndpointReason(endpoint.url);
    if (dispatchUrlError) {
      return {
        toolCallId: callId,
        name: tool.name,
        result: `Async tool dispatch failed: endpoint.url ${dispatchUrlError}`,
        displayText: tool.description.slice(0, 50),
      };
    }
    if (endpoint.asyncPollUrl) {
      const pollUrlError = insecureEndpointReason(endpoint.asyncPollUrl);
      if (pollUrlError) {
        return {
          toolCallId: callId,
          name: tool.name,
          result: `Async tool dispatch failed: endpoint.asyncPollUrl ${pollUrlError}`,
          displayText: tool.description.slice(0, 50),
        };
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpoint.timeoutMs);

    const headers: Record<string, string> = {
      // Spread configured headers first so the mandatory
      // Content-Type and X-Kody-Async markers can't be overridden
      // by an operator who misconfigures the tool.
      ...endpoint.headers,
      "Content-Type": "application/json",
      "X-Kody-Async": "true",
    };

    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers,
        body: JSON.stringify({ tool: tool.name, arguments: args }),
        signal: controller.signal,
        // undici's default redirect behavior is 'follow', which
        // would chase any 3xx up to the implementation's
        // internal limit (20 in current undici) and present the
        // final hop's response as if it had come from the
        // endpoint URL. For the async-tool dispatch we want to
        // *reject* redirects before the response is validated:
        // a misconfigured endpoint that 302s to a third party
        // should fail loudly, not silently pivot the server to
        // an attacker-controlled host. The `pollUrl` re-origin
        // check below still guards the polling hop, but that
        // guard assumes the initial response came from the
        // configured endpoint - 'error' enforces that invariant
        // at dispatch time.
        redirect: "error",
      });

      if (response.status === 202) {
        const payload = await parseAsyncDispatchResponse(response);
        if (!payload.jobId) {
          return {
            toolCallId: callId,
            name: tool.name,
            result: `Async tool returned 202 but no jobId in body`,
            displayText: tool.description.slice(0, 50),
          };
        }

        // Validate any poll URL the response provides before we
        // trust it. Without this check, a misbehaving endpoint
        // could redirect the server's polling to an attacker-
        // controlled host (SSRF) or to a metadata endpoint.
        let pollUrl: string | undefined;
        let pollUrlRejected: string | undefined;
        if (typeof payload.pollUrl === "string" && payload.pollUrl) {
          const allowed = isAllowedPollUrl(payload.pollUrl, endpoint);
          if (allowed) {
            pollUrl = allowed;
          } else {
            pollUrlRejected = payload.pollUrl;
          }
        }
        if (!pollUrl) {
          pollUrl = endpoint.asyncPollUrl;
        }
        if (pollUrlRejected && !pollUrl) {
          return {
            toolCallId: callId,
            name: tool.name,
            result:
              "Async tool returned 202 with a pollUrl from a disallowed origin and no endpoint.asyncPollUrl is configured as a fallback.",
            displayText: tool.description.slice(0, 50),
          };
        }
        // `pollUrl` may still be undefined here — that's a
        // configuration gap, not a security issue, and the
        // agent's pollAsyncTool will surface a clear "no pollUrl"
        // error to the user. We still persist the job row and
        // return the async handle so the agent can at least
        // observe the dispatch (and so callers can correlate
        // logs).

        if (this.toolJobStore) {
          this.toolJobStore.create({
            jobId: payload.jobId,
            siteId: config.siteId,
            // The agent threads the visitor's sessionId through; if
            // it isn't provided (e.g. a unit test that doesn't care
            // about session scoping) we fall back to the "pending"
            // sentinel so the row is still queryable.
            sessionId: sessionId ?? "pending",
            toolName: tool.name,
            endpointUrl: endpoint.url,
            pollUrl,
          });
        }

        return {
          toolCallId: callId,
          name: tool.name,
          result: "",
          displayText: `${tool.description.slice(0, 50)} (in progress...)`,
          async: {
            jobId: payload.jobId,
            pollUrl,
            displayText: tool.description.slice(0, 50),
            initialStatus: payload.status === "running" ? "running" : "pending",
          },
        };
      }

      // Non-202: treat as a synchronous reply, same shape as
      // executeCustomTool's success path.
      const text = await response.text();
      if (!response.ok) {
        return {
          toolCallId: callId,
          name: tool.name,
          result: `Tool returned error ${response.status}: ${text.slice(0, 500)}`,
          displayText: tool.description.slice(0, 50),
        };
      }
      return {
        toolCallId: callId,
        name: tool.name,
        result: text.slice(0, 10000),
        displayText: tool.description.slice(0, 50),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        toolCallId: callId,
        name: tool.name,
        result: `Async tool dispatch failed: ${message}`,
        displayText: tool.description.slice(0, 50),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function parseAsyncDispatchResponse(response: Response): Promise<AsyncDispatchResponse> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as AsyncDispatchResponse;
  } catch {
    return {};
  }
}

/**
 * Return `candidate` only when it parses as a valid http(s) URL
 * whose origin matches the dispatch endpoint's origin or the
 * configured `asyncPollUrl` origin. Returns `null` otherwise so the
 * caller can fall back to the configured `asyncPollUrl` (or
 * surface an error if no fallback is configured).
 *
 * This is the SSRF guardrail for the async-tool polling path. A
 * customer endpoint that returns a `pollUrl` pointing at
 * `http://169.254.169.254/...` (cloud metadata) or an arbitrary
 * attacker host must be ignored.
 */
function isAllowedPollUrl(candidate: string, endpoint: CustomTool["endpoint"]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(new URL(endpoint.url).origin);
  } catch {
    // endpoint.url is validated by the schema; if it somehow
    // doesn't parse, fall through with no allowed origins.
  }
  if (endpoint.asyncPollUrl) {
    try {
      allowedOrigins.add(new URL(endpoint.asyncPollUrl).origin);
    } catch {
      // same — ignore
    }
  }
  return allowedOrigins.has(parsed.origin) ? parsed.toString() : null;
}

/**
 * Return a human-readable reason the URL is not acceptable as a
 * configured async-tool dispatch / poll endpoint, or `null` if
 * it is. Acceptable: any `https:` URL, or any `http:` URL whose
 * host is a loopback name. The loopback carve-out lets an
 * operator wire a self-hosted tool to `http://localhost` /
 * `http://127.0.0.1` / `http://service.localhost` for
 * development without opening every public endpoint to
 * cleartext. Anything else (a non-loopback `http:`, or a
 * non-http(s) protocol like `ftp:` / `file:` / `data:`) is
 * rejected with a message that names the offending input so
 * the misconfiguration is easy to fix.
 */
function insecureEndpointReason(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "is not a valid URL";
  }
  if (parsed.protocol === "https:") return null;
  if (parsed.protocol === "http:" && isLoopbackHost(parsed.hostname)) return null;
  if (parsed.protocol === "http:") {
    return "must use https (loopback http is allowed for development)";
  }
  return "must use http or https";
}

/**
 * True for hosts that are guaranteed to resolve to the local
 * machine: the reserved `localhost` name, any name under
 * `.localhost` (RFC 6761), the IPv4 loopback range
 * `127.0.0.0/8`, and the IPv6 loopback `::1`. Anything else
 * is treated as a public host and requires TLS.
 */
function isLoopbackHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname === "::1") return true;
  // `127.0.0.0/8` — the entire class-A block is reserved for
  // loopback (RFC 1122). We accept any address in the range
  // even though the spec only mandates `127.0.0.1`; treating
  // 127.x.y.z as loopback is what every browser / OS resolver
  // does in practice and matches what an operator expects
  // when they wire a sidecar to a non-default loopback IP.
  if (/^127\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  return false;
}
