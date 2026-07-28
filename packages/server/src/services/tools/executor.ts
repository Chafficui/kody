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

  async execute(call: ToolCallRequest, config: SiteConfig): Promise<ToolCallResult> {
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
      return this.executeAsyncCustomTool(call.id, customTool, args, config);
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
        headers: {
          "Content-Type": "application/json",
          ...endpoint.headers,
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
  ): Promise<ToolCallResult> {
    const { endpoint } = tool;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpoint.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Kody-Async": "true",
      ...endpoint.headers,
    };

    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers,
        body: JSON.stringify({ tool: tool.name, arguments: args }),
        signal: controller.signal,
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
        const pollUrl = payload.pollUrl ?? endpoint.asyncPollUrl;

        if (this.toolJobStore) {
          this.toolJobStore.create({
            jobId: payload.jobId,
            siteId: config.siteId,
            // We don't have a sessionId here; the agent will update it
            // when it picks the job up. Use a placeholder so the row
            // is still queryable.
            sessionId: "pending",
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
