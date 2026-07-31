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
  customToolSchema,
  textKnowledgeSourceSchema,
  urlKnowledgeSourceSchema,
  fileKnowledgeSourceSchema,
  faqKnowledgeSourceSchema,
  jiraTicketProviderSchema,
  githubTicketProviderSchema,
  linearTicketProviderSchema,
  emailTicketProviderSchema,
  webhookTicketProviderSchema,
  chatRequestSchema,
  chatResponseEventSchema,
  feedbackRequestSchema,
  ticketRequestSchema,
  ticketResultSchema,
  adminLoginSchema,
  adminCreateUserSchema,
} from "../validators/index.js";

/**
 * Strip server-side secrets from a `SiteConfig` for the read model.
 *
 * The server validates secrets on input (create/update) but should never
 * echo them back in GET responses. This shape matches what the public
 * `PublicSiteConfig` already does for the embed widget, plus it preserves
 * enough information for the admin UI to know a field is configured
 * (e.g. `apiKey: "***"`) so operators can edit without seeing the value.
 */
function redactSiteConfigForRead(oas: Record<string, unknown>): Record<string, unknown> {
  const props = (oas.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
  const ai = (props.ai?.properties as Record<string, unknown> | undefined) ?? {};
  const aiRedacted: Record<string, unknown> = { ...ai, apiKey: { type: "string", description: "Redacted; create/update only." } };
  const tickets = (props.tickets?.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
  const ticketProviders = (tickets.providers?.items as Record<string, unknown> | undefined) ?? {};
  const branches = (ticketProviders.oneOf as Array<Record<string, unknown>> | undefined) ?? [];
  const redactedBranches = branches.map((branch) => {
    const branchProps = (branch.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
    const providerEnum = ((branchProps.provider as { enum?: string[] } | undefined)?.enum ?? []) as string[];
    if (branchProps.apiToken) {
      branchProps.apiToken = { type: "string", description: "Redacted; create/update only." };
    }
    if (branchProps.token && providerEnum.includes("github")) {
      branchProps.token = { type: "string", description: "Redacted; create/update only." };
    }
    if (branchProps.apiKey && providerEnum.includes("linear")) {
      branchProps.apiKey = { type: "string", description: "Redacted; create/update only." };
    }
    if (branchProps.smtpPass) {
      branchProps.smtpPass = { type: "string", description: "Redacted; create/update only." };
    }
    if (branchProps.secret) {
      branchProps.secret = { type: "string", description: "Redacted; create/update only." };
    }
    branch.properties = branchProps;
    return branch;
  });
  if (redactedBranches.length > 0) {
    ticketProviders.oneOf = redactedBranches;
  }
  tickets.providers = ticketProviders;
  props.tickets = { ...tickets };
  props.ai = { ...aiRedacted };
  return { ...oas, properties: props };
}

/** Build the `components.schemas` block by mapping each Zod validator. */
function buildComponents(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.SiteConfig = zodToOas(siteConfigSchema);
  // Redacted read model used by the admin GET endpoints.
  out.SiteConfigRead = redactSiteConfigForRead(out.SiteConfig as Record<string, unknown>);
  out.PublicSiteConfig = zodToOas(publicSiteConfigSchema);
  out.KnowledgeSource = zodToOas(knowledgeSourceSchema);
  // Named union branches so SDK generators can reference them by $ref
  // instead of seeing an inline oneOf they can't resolve.
  out.KnowledgeSourceText = zodToOas(textKnowledgeSourceSchema);
  out.KnowledgeSourceUrl = zodToOas(urlKnowledgeSourceSchema);
  out.KnowledgeSourceFile = zodToOas(fileKnowledgeSourceSchema);
  out.KnowledgeSourceFaq = zodToOas(faqKnowledgeSourceSchema);
  out.TicketProvider = zodToOas(ticketProviderSchema);
  out.TicketProviderJira = zodToOas(jiraTicketProviderSchema);
  out.TicketProviderGithub = zodToOas(githubTicketProviderSchema);
  out.TicketProviderLinear = zodToOas(linearTicketProviderSchema);
  out.TicketProviderEmail = zodToOas(emailTicketProviderSchema);
  out.TicketProviderWebhook = zodToOas(webhookTicketProviderSchema);
  out.ToolsConfig = zodToOas(toolsSchema);
  // CustomTool is the same Zod the server validates against, so any
  // future change flows into the public spec automatically.
  out.CustomTool = zodToOas(customToolSchema);
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
          description: "httpOnly cookie set by the browser on admin login. Alternative to bearerAuth for browser-based admin clients.",
        },
      },
    },
  };
}
