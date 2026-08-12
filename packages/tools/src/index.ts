/**
 * @kody/tools — pre-built tool definitions and a fluent toolkit builder.
 *
 * Public surface:
 *   - {@link httpGet}, {@link httpPost}: agent-driven HTTP tools.
 *   - {@link webhook}, {@link slack}, {@link linear}, {@link sendgridEmail}:
 *     pre-built tools for common third-party APIs.
 *   - {@link Toolkit}: fluent builder that bundles tools for a SiteConfig.
 *   - {@link ToolRegistry}: in-process handler map the server can dispatch
 *     to without going through an HTTP endpoint URL.
 *   - {@link httpCall}, {@link pluckPath}: low-level HTTP helpers.
 */

export type {
  Tool,
  ToolDefinition,
  ToolHandler,
  ToolHandlerResult,
  ToolParameter,
  ToolParameterSchema,
} from "./types.js";

export { httpCall, pluckPath, type HttpCallOptions, type HttpCallResult } from "./http.js";

export {
  httpGet,
  httpPost,
  httpGetWithHosts,
  httpPostWithHosts,
  webhook,
  slack,
  linear,
  sendgridEmail,
  type WebhookOptions,
  type SlackOptions,
  type LinearOptions,
  type SendgridEmailOptions,
} from "./prebuilt.js";

export {
  Toolkit,
  ToolRegistry,
  INPROC_TOOL_MARKER,
  type ToolkitEntry,
  type ToolkitExport,
} from "./toolkit.js";
