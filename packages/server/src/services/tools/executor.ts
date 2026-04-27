import type { SiteConfig, CustomTool } from "@kody/shared";
import type { ToolCallRequest, ToolDefinition } from "../ai-provider.js";
import type { KnowledgeRetriever } from "../knowledge/retriever.js";
import { getBuiltinToolDefinitions, executeBuiltinTool } from "./builtin.js";

const BUILTIN_TOOL_NAMES = new Set(["knowledge_search", "create_ticket"]);

export interface ToolCallResult {
  toolCallId: string;
  name: string;
  result: string;
  displayText: string;
}

export class ToolExecutor {
  constructor(private retriever: KnowledgeRetriever | null) {}

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
}
