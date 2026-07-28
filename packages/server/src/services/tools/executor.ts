import { createHmac } from "node:crypto";
import type { SiteConfig, CustomTool } from "@kody/shared";
import type { ToolCallRequest, ToolDefinition } from "../ai-provider.js";
import type { ToolHandler } from "@kody/tools";
import type { KnowledgeRetriever } from "../knowledge/retriever.js";
import { getBuiltinToolDefinitions, executeBuiltinTool } from "./builtin.js";
import { ToolRegistry } from "@kody/tools";

const BUILTIN_TOOL_NAMES = new Set(["knowledge_search", "create_ticket"]);

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Structured result returned by every tool call. `ok: false` is informational — never thrown. */
export interface ToolCallResult {
  toolCallId: string;
  name: string;
  ok: boolean;
  result: string;
  displayText: string;
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true;
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

    // 1. Try the in-process handler registry (pre-built tools).
    const handler = this.registry.get(name);
    if (handler) {
      try {
        const out = await handler(args);
        const ok = out.ok ?? true;
        return {
          toolCallId: call.id,
          name,
          ok,
          result: typeof out === "string" ? out : JSON.stringify(out),
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
    const maxAttempts = endpoint.retry?.maxAttempts ?? 1;
    const baseDelay = endpoint.retry?.baseDelayMs ?? 250;

    const bodyText = JSON.stringify({ tool: tool.name, arguments: args });

    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...endpoint.headers,
    };
    if (endpoint.secret) {
      baseHeaders["X-Kody-Signature"] = createHmac("sha256", endpoint.secret)
        .update(bodyText)
        .digest("hex");
    }
    if (endpoint.auth) {
      const value = resolveAuthValue(endpoint.auth.value, endpoint.auth.fromEnv ?? false);
      if (endpoint.auth.type === "bearer") {
        baseHeaders["Authorization"] = `Bearer ${value}`;
      } else {
        const headerName = endpoint.auth.headerName ?? "Authorization";
        baseHeaders[headerName] = value;
      }
    }

    let lastResult: { status: number; text: string; ok: boolean } = {
      status: 0,
      text: "",
      ok: false,
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), endpoint.timeoutMs);
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: baseHeaders,
          body: bodyText,
          signal: controller.signal,
        });

        const text = await response.text();
        clearTimeout(timer);

        if (!response.ok && TRANSIENT_STATUS.has(response.status) && attempt < maxAttempts) {
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
          result: text.slice(0, 10000),
          displayText: tool.description.slice(0, 50),
        };
      } catch (err) {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : "Unknown error";
        lastResult = { status: 0, text: message, ok: false };
        if (attempt < maxAttempts && isRetryableError(err)) {
          await sleep(baseDelay * 2 ** (attempt - 1));
          continue;
        }
        const label =
          err instanceof Error && err.name === "AbortError" ? "timeout" : "network error";
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
