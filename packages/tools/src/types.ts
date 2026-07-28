/**
 * Public type definitions for the @kody/tools package.
 *
 * Tools are first-class functions that turn user-defined arguments into a
 * structured result. The `ToolDefinition` mirrors the OpenAI-style function
 * shape so any compatible agent loop can consume it.
 */

/** JSON Schema fragment for a single tool parameter. */
export interface ToolParameter {
  type: "string" | "number" | "boolean" | "integer";
  description?: string;
  enum?: string[];
}

/** Object schema for a tool's parameters. */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, ToolParameter>;
  required?: string[];
}

/** OpenAI-style tool definition; consumable by the agent loop. */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

/** Result returned by every tool handler. The agent loop converts this to text. */
export interface ToolHandlerResult {
  /** Stable identifier (e.g. webhook id, Slack ts, Linear identifier). */
  id?: string;
  /** Human-readable summary. */
  message: string;
  /** Optional structured payload, surfaced as JSON to the caller. */
  data?: unknown;
  /** Marks the call as failed even when the upstream returned 2xx with an error envelope. */
  ok?: boolean;
}

/** Async function executed when the agent invokes the tool. */
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

/** A tool is a definition plus a runtime handler. */
export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
