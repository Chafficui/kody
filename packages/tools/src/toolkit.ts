/**
 * Fluent builder that accumulates pre-built tools and produces both:
 *   - `customTools`: array of `CustomTool` objects ready to merge into a
 *     `SiteConfig.tools.customTools` list.
 *   - `builtinTools`: partial map of `SiteConfig.tools.builtinTools`.
 *   - `handlers`: name → handler map ready to install in a server-side
 *     `ToolRegistry` so the agent loop can dispatch without going through
 *     the HTTP endpoint URL.
 *
 * Use `Toolkit` at server startup to compose the tool surface from
 * environment variables and host-specific configuration.
 */

import type { CustomTool, ToolsConfig } from "@kody/shared";
import type { Tool, ToolHandler } from "./types.js";

export interface ToolkitEntry {
  /** Stable name used to look up the tool at runtime. Must be unique. */
  name: string;
  definition: Tool["definition"];
  handler: ToolHandler;
}

export interface ToolkitExport {
  /** Drop into `SiteConfig.tools.customTools`. */
  customTools: CustomTool[];
  /** Drop into `SiteConfig.tools.builtinTools`. */
  builtinTools: ToolsConfig["builtinTools"];
  /** Install in the server's `ToolRegistry` so the executor can dispatch. */
  handlers: Map<string, ToolHandler>;
}

/**
 * Marker URL for in-process tools — the executor recognises this and
 * dispatches via the `ToolRegistry` instead of attempting an HTTP fetch.
 * The marker is non-fetchable (it's a non-routable scheme + host) so an
 * accidental network call would fail before reaching any real service.
 */
export const INPROC_TOOL_MARKER = "kody://inproc/__kody_internal__";

/**
 * A registry of name → handler pairs. The server's ToolExecutor consults
 * the registry before falling back to the HTTP endpoint configured in the
 * SiteConfig, so a pre-built tool can run entirely in-process.
 */
export class ToolRegistry {
  private readonly map = new Map<string, ToolHandler>();

  /** Register or replace a handler. */
  register(name: string, handler: ToolHandler): void {
    this.map.set(name, handler);
  }

  /** Look up a handler by name. Returns undefined when not registered. */
  get(name: string): ToolHandler | undefined {
    return this.map.get(name);
  }

  /** Remove a handler. No-op when not present. */
  unregister(name: string): void {
    this.map.delete(name);
  }

  /** Bulk-merge another registry's handlers. Later wins on conflict. */
  merge(other: ToolRegistry | Map<string, ToolHandler>): void {
    const src = other instanceof ToolRegistry ? other.map : other;
    for (const [name, handler] of src) this.map.set(name, handler);
  }

  /** List of registered tool names. */
  names(): string[] {
    return Array.from(this.map.keys());
  }

  /** Number of registered handlers. */
  size(): number {
    return this.map.size;
  }
}

/** Conversion helper — turn a Tool into a CustomTool config entry. */
function toolToCustomTool(tool: Tool): CustomTool {
  return {
    name: tool.definition.function.name,
    description: tool.definition.function.description,
    parameters: tool.definition.function.parameters as unknown as CustomTool["parameters"],
    endpoint: {
      url: INPROC_TOOL_MARKER,
      method: "POST",
      headers: {},
      timeoutMs: 10_000,
    },
  };
}

/**
 * Fluent toolkit builder. Methods return `this` for chaining.
 */
export class Toolkit {
  private readonly entries: ToolkitEntry[] = [];

  /** Add a pre-built tool. Throws when the alias or the tool's original function name is already registered. */
  add(tool: Tool): this {
    const name = tool.definition.function.name;
    this.assertNoCollision(name, tool.definition.function.name);
    this.entries.push({ name, definition: tool.definition, handler: tool.handler });
    return this;
  }

  /** Add a tool with a custom alias. The original `tool.definition.function.name` is preserved on the definition. */
  addAs(alias: string, tool: Tool): this {
    this.assertNoCollision(alias, tool.definition.function.name);
    const renamed: Tool = {
      definition: { ...tool.definition, function: { ...tool.definition.function, name: alias } },
      handler: tool.handler,
    };
    this.entries.push({ name: alias, definition: renamed.definition, handler: renamed.handler });
    return this;
  }

  /** Remove a tool by alias. */
  remove(name: string): this {
    const idx = this.entries.findIndex((e) => e.name === name);
    if (idx >= 0) this.entries.splice(idx, 1);
    return this;
  }

  /** Number of registered entries. */
  size(): number {
    return this.entries.length;
  }

  /** List of registered aliases. */
  names(): string[] {
    return this.entries.map((e) => e.name);
  }

  /**
   * Materialise the toolkit into a SiteConfig-ready bundle + a runtime
   * handler map. The returned `customTools` is safe to drop into
   * `SiteConfig.tools.customTools`; the `handlers` map is safe to merge
   * into a server `ToolRegistry`.
   */
  export(): ToolkitExport {
    const customTools: CustomTool[] = this.entries.map((e) =>
      toolToCustomTool({ definition: e.definition, handler: e.handler }),
    );
    const handlers = new Map<string, ToolHandler>();
    for (const e of this.entries) handlers.set(e.name, e.handler);
    return {
      customTools,
      builtinTools: { knowledgeSearch: true },
      handlers,
    };
  }

  /**
   * Throw when `alias` is already registered, or when the incoming tool's
   * original function name is already represented under a different alias.
   */
  private assertNoCollision(alias: string, originalName: string): void {
    if (this.entries.some((e) => e.name === alias)) {
      throw new Error(`Tool "${alias}" is already registered in this toolkit`);
    }
    if (alias !== originalName) {
      const clash = this.entries.find((e) => e.definition.function.name === originalName);
      if (clash) {
        throw new Error(
          `Tool "${originalName}" is already registered as "${clash.name}" in this toolkit`,
        );
      }
    }
  }
}
