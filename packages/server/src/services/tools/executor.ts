import { createHmac, randomUUID } from "node:crypto";
import type { SiteConfig, CustomTool } from "@kody/shared";
import type { ToolCallRequest, ToolDefinition } from "../ai-provider.js";
import { INPROC_TOOL_MARKER, ToolRegistry } from "@kody/tools";
import type { ToolHandler } from "@kody/tools";
import type { KnowledgeRetriever } from "../knowledge/retriever.js";
import { getBuiltinToolDefinitions, executeBuiltinTool } from "./builtin.js";

const BUILTIN_TOOL_NAMES = new Set(["knowledge_search", "create_ticket"]);

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
/** HTTP methods that are safe to retry without caller-supplied idempotency. */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

/** Structured result returned by every tool call. `ok: false` is informational — never thrown. */
export interface ToolCallResult {
  toolCallId: string;
  name: string;
  ok: boolean;
  result: string;
  displayText: string;
}

/**
 * Returns true only for transient network errors we want to retry. We do NOT
 * treat every TypeError as retryable — fetch raises TypeError for many
 * programmer errors (invalid URL, body-after-stream, etc.).
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof Error && "code" in err) {
    const code = (err as NodeJS.ErrnoException).code;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve an auth value, optionally from `process.env`. */
function resolveAuthValue(value: string, fromEnv: boolean): string {
  if (!fromEnv) return value;
  const envValue = process.env[value];
  if (envValue === undefined) {
    throw new Error(`Auth env var "${value}" is not set`);
  }
  return envValue;
}

/**
 * Dispatches tool calls. Built-in tools (`knowledge_search`, `create_ticket`)
 * and registered in-process handlers are tried first; custom HTTP tools
 * defined in the SiteConfig are the fallback.
 */
export class ToolExecutor {
  private readonly registry = new ToolRegistry();

  constructor(private retriever: KnowledgeRetriever | null) {}

  /**
   * Expose the in-process handler registry. Servers wire pre-built tools
   * (e.g. from @kody/tools' Toolkit.export()) into the executor at startup.
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

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

  async execute(call: ToolCallRequest, config: SiteConfig): Promise<ToolCallResult> {
    const name = call.function.name;

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      return {
        toolCallId: call.id,
        name,
        ok: false,
        result: "Invalid arguments: failed to parse JSON",
        displayText: `Running ${name}...`,
      };
    }

    // 1. Try the in-process handler registry (pre-built tools). An in-process
    //    tool MUST be declared in `config.tools.customTools` with the
    //    in-process marker URL — that is what makes the registration visible
    //    to the agent at definition time. If a handler is registered but the
    //    tool isn't declared, fail explicitly rather than silently dispatching.
    const handler = this.registry.get(name);
    if (handler) {
      const declared = config.tools.customTools.find(
        (t) => t.name === name && t.endpoint.url === INPROC_TOOL_MARKER,
      );
      if (!declared) {
        return {
          toolCallId: call.id,
          name,
          ok: false,
          result:
            `In-process tool "${name}" is not declared in the site config; ` +
            "register it in config.tools.customTools with the in-process marker URL.",
          displayText: `Running ${name}...`,
        };
      }
      try {
        const out = await handler(args);
        const ok = out.ok ?? true;
        return {
          toolCallId: call.id,
          name,
          ok,
          result: JSON.stringify(out),
          displayText: `Running ${name}...`,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          toolCallId: call.id,
          name,
          ok: false,
          result: `Tool execution failed: ${message}`,
          displayText: `Running ${name}...`,
        };
      }
    }

    // 2. Built-in tools (knowledge_search, create_ticket).
    if (BUILTIN_TOOL_NAMES.has(name)) {
      try {
        const { result, displayText } = await executeBuiltinTool(
          name,
          args,
          config,
          this.retriever,
        );
        return { toolCallId: call.id, name, ok: true, result, displayText };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          toolCallId: call.id,
          name,
          ok: false,
          result: `Tool execution failed: ${message}`,
          displayText: `Running ${name}...`,
        };
      }
    }

    // 3. Custom HTTP tools.
    const customTool = config.tools.customTools.find((t) => t.name === name);
    if (!customTool) {
      return {
        toolCallId: call.id,
        name,
        ok: false,
        result: `Unknown tool: ${name}`,
        displayText: `Running ${name}...`,
      };
    }

    return this.executeCustomTool(call.id, customTool, args);
  }

  private async executeCustomTool(
    callId: string,
    tool: CustomTool,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const { endpoint } = tool;
    const methodIsIdempotent = IDEMPOTENT_METHODS.has(endpoint.method);
    const maxAttempts = endpoint.retry?.maxAttempts ?? 1;
    const baseDelay = endpoint.retry?.baseDelayMs ?? 250;
    // Stable idempotency key for the whole call so receivers can dedupe
    // retried POST/PUT/PATCH requests. Only generated when the call may
    // actually be retried (idempotent method or explicit retry config).
    const idempotencyKey =
      methodIsIdempotent || (maxAttempts > 1) ? randomUUID() : undefined;
    const effectiveMax = methodIsIdempotent || idempotencyKey ? maxAttempts : 1;

    const bodyText = JSON.stringify({ tool: tool.name, arguments: args });

    // Build the headers. The auth resolution happens inside the try/catch
    // so a missing env var becomes a structured tool failure, not a
    // thrown error that escapes the executor's never-throw contract.
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...endpoint.headers,
    };
    if (idempotencyKey) baseHeaders["Idempotency-Key"] = idempotencyKey;
    if (endpoint.secret) {
      baseHeaders["X-Kody-Signature"] = createHmac("sha256", endpoint.secret)
        .update(bodyText)
        .digest("hex");
    }
    if (endpoint.auth) {
      try {
        const value = resolveAuthValue(endpoint.auth.value, endpoint.auth.fromEnv ?? false);
        if (endpoint.auth.type === "bearer") {
          baseHeaders["Authorization"] = `Bearer ${value}`;
        } else {
          const headerName = endpoint.auth.headerName ?? "Authorization";
          baseHeaders[headerName] = value;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Auth configuration error";
        return {
          toolCallId: callId,
          name: tool.name,
          ok: false,
          result: `Tool execution failed (auth): ${message}`,
          displayText: tool.description.slice(0, 50),
        };
      }
    }

    let lastResult: { status: number; text: string; ok: boolean } = {
      status: 0,
      text: "",
      ok: false,
    };

    for (let attempt = 1; attempt <= effectiveMax; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), endpoint.timeoutMs);
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: baseHeaders,
          body: bodyText,
          signal: controller.signal,
          redirect: "manual",
        });

        const text = await response.text();
        clearTimeout(timer);

        if (!response.ok && TRANSIENT_STATUS.has(response.status) && attempt < effectiveMax) {
          lastResult = { status: response.status, text, ok: false };
          await sleep(baseDelay * 2 ** (attempt - 1));
          continue;
        }

        if (!response.ok) {
          return {
            toolCallId: callId,
            name: tool.name,
            ok: false,
            result: `Tool returned error ${response.status}: ${text.slice(0, 500)}`,
            displayText: tool.description.slice(0, 50),
          };
        }

        return {
          toolCallId: callId,
          name: tool.name,
          ok: true,
          // Keep a generous cap here — the admin UI and the agent loop
          // both apply their own limits downstream.
          result: text.slice(0, 50_000),
          displayText: tool.description.slice(0, 50),
        };
      } catch (err) {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : "Unknown error";
        lastResult = { status: 0, text: message, ok: false };
        const isAbort = err instanceof Error && err.name === "AbortError";
        // AbortError retries are only safe for GET — POST/PUT/PATCH may
        // have landed server-side before the timeout fired. The
        // idempotency key makes retries safe for those methods.
        if (isAbort && endpoint.method !== "GET" && !idempotencyKey) {
          return {
            toolCallId: callId,
            name: tool.name,
            ok: false,
            result: `Tool execution failed (timeout): ${message}`,
            displayText: tool.description.slice(0, 50),
          };
        }
        if (attempt < effectiveMax && isRetryableError(err)) {
          await sleep(baseDelay * 2 ** (attempt - 1));
          continue;
        }
        const label = isAbort ? "timeout" : "network error";
        return {
          toolCallId: callId,
          name: tool.name,
          ok: false,
          result: `Tool execution failed (${label}): ${message}`,
          displayText: tool.description.slice(0, 50),
        };
      }
    }

    return {
      toolCallId: callId,
      name: tool.name,
      ok: false,
      result: `Tool execution failed: ${lastResult.text || "retries exhausted"}`,
      displayText: tool.description.slice(0, 50),
    };
  }
}
