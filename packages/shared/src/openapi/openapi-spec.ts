/**
 * Assembles the full OpenAPI 3.1 document for the Kody server.
 *
 * Pulls the Zod validators from `../validators/*`, maps them to JSON Schema
 * via `schema-mapper.ts`, and combines them with the hand-written `paths.ts`
 * into a single spec object ready to be dumped to YAML.
 */
import { zodToOas } from "./schema-mapper.js";
import { paths, type OasPathItem } from "./paths.js";
import {
  siteConfigSchema,
  publicSiteConfigSchema,
  knowledgeSourceSchema,
  ticketProviderSchema,
  toolsSchema,
  chatRequestSchema,
  chatResponseEventSchema,
  feedbackRequestSchema,
  ticketRequestSchema,
  ticketResultSchema,
  adminLoginSchema,
  adminCreateUserSchema,
} from "../validators/index.js";

/** Build the `components.schemas` block by mapping each Zod validator. */
function buildComponents(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.SiteConfig = zodToOas(siteConfigSchema);
  out.PublicSiteConfig = zodToOas(publicSiteConfigSchema);
  out.KnowledgeSource = zodToOas(knowledgeSourceSchema);
  out.TicketProvider = zodToOas(ticketProviderSchema);
  out.ToolsConfig = zodToOas(toolsSchema);
  out.ChatRequest = zodToOas(chatRequestSchema);
  out.ChatResponseEvent = zodToOas(chatResponseEventSchema);
  // Wrap the discriminated-union event schema into a stream-friendly form.
  out.ChatEventStream = {
    type: "object",
    description:
      "SSE payload. The discriminator is the `event` field (defaults to `message` for plain data lines). Each `data` field is a ChatResponseEvent JSON object.",
    properties: {
      event: { type: "string", description: "Optional SSE event name." },
      data: { $ref: "#/components/schemas/ChatResponseEvent" },
      id: { type: "string" },
      retry: { type: "integer" },
    },
    required: ["data"],
  };
  out.FeedbackRequest = zodToOas(feedbackRequestSchema);
  out.TicketRequest = zodToOas(ticketRequestSchema);
  out.TicketResult = zodToOas(ticketResultSchema);
  out.AdminLogin = zodToOas(adminLoginSchema);
  out.AdminCreateUser = zodToOas(adminCreateUserSchema);
  // `customToolSchema` is a private Zod object inside `toolsSchema`. We
  // expose a hand-mirrored fragment under its own name so SDK generators
  // can produce a typed `CustomTool` interface. (The full definition lives
  // inside the `ToolsConfig` schema above.)
  out.CustomTool = {
    type: "object",
    description: "An HTTP-callable custom tool the assistant can invoke.",
    required: ["name", "description", "parameters", "endpoint"],
    properties: {
      name: { type: "string", pattern: "^[a-z_][a-z0-9_]*$" },
      description: { type: "string", maxLength: 1000 },
      parameters: {
        type: "object",
        required: ["type", "properties"],
        properties: {
          type: { type: "string", enum: ["object"] },
          properties: { type: "object", additionalProperties: true },
          required: { type: "array", items: { type: "string" } },
        },
      },
      endpoint: {
        type: "object",
        required: ["url", "method"],
        properties: {
          url: { type: "string", format: "uri" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH"] },
          headers: { type: "object", additionalProperties: { type: "string" } },
          timeoutMs: { type: "integer", minimum: 1000, maximum: 30000 },
        },
      },
    },
  };
  return out;
}

/** Build the full OpenAPI document. */
export function buildOpenApiSpec(): {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description?: string }>;
  paths: Record<string, OasPathItem>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
} {
  return {
    openapi: "3.1.0",
    info: {
      title: "Kody API",
      version: "0.1.0",
      description:
        "Kody is a self-hosted, embeddable AI chat assistant. This document describes every public HTTP endpoint exposed by the Kody server. Endpoints under `/api/admin/*` require a bearer token obtained from `POST /api/admin/login`. All other endpoints are gated by the `Origin` header against the site's `allowedOrigins` and a `x-kody-site-id` header.",
    },
    servers: [
      {
        url: "http://localhost:3456",
        description: "Default local development server",
      },
    ],
    tags: [
      { name: "system", description: "Liveness and metadata" },
      { name: "config", description: "Public site configuration" },
      { name: "chat", description: "Widget-facing chat endpoints" },
      { name: "tickets", description: "Support ticket creation" },
      { name: "sessions", description: "Conversation lifecycle (GDPR)" },
      { name: "feedback", description: "Per-message quality feedback" },
      { name: "admin", description: "Admin authentication" },
      { name: "sites", description: "Site configuration CRUD (admin)" },
      { name: "users", description: "Admin user management" },
      { name: "logs", description: "Server log inspection" },
      { name: "scraping", description: "Knowledge base re-scraping" },
    ],
    paths,
    components: {
      schemas: buildComponents(),
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "opaque",
          description:
            "Token returned by `POST /api/admin/login`. Send as `Authorization: Bearer <token>`.",
        },
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "kody_session",
          description: "httpOnly cookie set by the browser on admin login.",
        },
      },
    },
  };
}
