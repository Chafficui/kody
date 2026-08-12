/**
 * OpenAPI 3.1 path definitions for the Kody public + admin API.
 *
 * These are hand-written — there are only ~12 endpoints and the operations
 * have meaningful prose. The body and response schemas reference the
 * generated components (see `openapi-spec.ts`) so they stay in sync with
 * the Zod validators.
 */
import type { OasSchema } from "./schema-mapper.js";

/** Minimal subset of the OpenAPI Path Item Object we need. */
export type OasParameter = {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: string;
  schema: OasSchema;
};

export type OasRequestBody = {
  required?: boolean;
  description?: string;
  content: Record<string, { schema: OasSchema }>;
};

export type OasResponse = {
  description: string;
  content?: Record<string, { schema: OasSchema }>;
  headers?: Record<string, unknown>;
};

export type OasOperation = {
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OasParameter[];
  requestBody?: OasRequestBody;
  responses: Record<string, OasResponse>;
  security?: Array<Record<string, string[]>>;
};

export type OasPathItem = {
  summary?: string;
  description?: string;
  parameters?: OasParameter[];
  get?: OasOperation;
  post?: OasOperation;
  put?: OasOperation;
  delete?: OasOperation;
  patch?: OasOperation;
};

/** Security entry for operations that require admin auth. Accepts either a
 *  bearer token (CLI / scripts) or the httpOnly session cookie (browser). */
const adminSecurity: Array<Record<string, string[]>> = [{ bearerAuth: [] }, { sessionCookie: [] }];

/**
 * Parameter object for the `x-kody-site-id` header. Required on every
 * widget-facing endpoint so the server can look up the right site config
 * (the host header only tells it the customer's domain, not which Kody
 * site on a multi-tenant install is being asked for).
 */
const siteIdHeader: OasParameter = {
  name: "x-kody-site-id",
  in: "header",
  required: true,
  description: "Lowercase site id (e.g. `my-shop`). Required on every widget-facing endpoint.",
  schema: { type: "string", pattern: "^[a-z0-9-]+$" },
};

export const paths: Record<string, OasPathItem> = {
  "/health": {
    summary: "Liveness probe",
    get: {
      summary: "Server health check",
      description:
        "Returns 200 with a static payload while the process is up. Used by Docker, load balancers, and `kody doctor`.",
      tags: ["system"],
      responses: {
        "200": {
          description: "Server is alive",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status", "timestamp"],
                properties: {
                  status: { type: "string", enum: ["ok"] },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/config/{siteId}": {
    summary: "Public site config (used by the embed widget)",
    get: {
      summary: "Fetch the public-facing configuration for a site",
      description:
        "Returns the safe subset of the site config (branding, ticket prompt, conversation starters). No secrets, no guardrail internals. Cached aggressively by the widget on first load.",
      tags: ["config"],
      parameters: [
        {
          name: "siteId",
          in: "path",
          required: true,
          description: "Lowercase alphanumeric site identifier.",
          schema: { type: "string", pattern: "^[a-z0-9-]+$" },
        },
      ],
      responses: {
        "200": {
          description: "Public site configuration",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PublicSiteConfig" },
            },
          },
        },
        "400": { description: "Missing or malformed x-kody-site-id header" },
        "403": { description: "Origin not allowed for this site" },
        "404": { description: "Site not found or disabled" },
      },
    },
  },

  "/api/chat": {
    summary: "Send a chat message (SSE response)",
    post: {
      summary: "Start or continue a chat conversation",
      description:
        "Streams a server-sent event response. The first event is always a `session` event with a server-issued session id. Subsequent events are `delta` (token chunks), `tool_start` / `tool_end`, `sources`, `suggestions`, `blocked`, `error`, and finally `done`.",
      tags: ["chat"],
      parameters: [siteIdHeader],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ChatRequest" },
          },
        },
      },
      responses: {
        "200": {
          description: "Server-sent event stream of chat events",
          content: {
            "text/event-stream": {
              schema: { $ref: "#/components/schemas/ChatEventStream" },
            },
          },
        },
        "400": { description: "Missing site id header, invalid request body, or unknown site id" },
        "403": { description: "Origin not allowed for this site" },
        "404": { description: "Site not found or disabled" },
        "429": { description: "Rate limit exceeded" },
      },
    },
  },

  "/api/tickets": {
    summary: "Create a support ticket from a conversation",
    post: {
      summary: "Create a ticket for the current session",
      description:
        "Sends the conversation transcript (optionally) plus the required fields to the first configured ticket provider (Jira, GitHub, Linear, email, or webhook).",
      tags: ["tickets"],
      parameters: [siteIdHeader],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TicketRequest" },
          },
        },
      },
      responses: {
        "200": {
          description: "Ticket created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TicketResult" },
            },
          },
        },
        "400": {
          description:
            "Tickets not enabled, invalid request, or unknown / disabled site id",
        },
        "403": { description: "Origin not allowed for this site" },
        "404": { description: "Site not found or disabled" },
        "429": { description: "Rate limit exceeded" },
      },
    },
  },

  "/api/sessions/{sessionId}": {
    summary: "Delete a chat session (GDPR right-to-erasure)",
    delete: {
      summary: "Forget a conversation",
      description: "Removes all in-memory messages and the persisted feedback for the session.",
      tags: ["sessions"],
      parameters: [
        {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        siteIdHeader,
      ],
      responses: {
        "204": { description: "Session deleted" },
        "400": { description: "Missing or malformed x-kody-site-id header" },
        "403": { description: "Origin not allowed for this site" },
        "404": { description: "Site not found or disabled" },
      },
    },
  },

  "/api/feedback": {
    summary: "Record thumbs-up/down on an assistant message",
    post: {
      summary: "Submit feedback for a chat message",
      description: "Stores `(sessionId, messageIndex, rating)` for the admin dashboard's quality view.",
      tags: ["feedback"],
      parameters: [siteIdHeader],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/FeedbackRequest" },
          },
        },
      },
      responses: {
        "201": { description: "Feedback stored" },
        "400": { description: "Invalid request, missing site id header, or unknown site id" },
        "403": { description: "Origin not allowed for this site" },
        "404": { description: "Site not found or disabled" },
      },
    },
  },

  "/api/admin/login": {
    summary: "Admin login (issues a session cookie + bearer token)",
    post: {
      summary: "Authenticate as an admin",
      description:
        "Returns a 24-hour bearer token in the JSON body and sets an httpOnly cookie. The same token is accepted via `Authorization: Bearer …` for CLI / script use.",
      tags: ["admin"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminLogin" },
          },
        },
      },
      responses: {
        "200": {
          description: "Login successful",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminLoginResponse" },
            },
          },
        },
        "401": { description: "Invalid credentials" },
      },
    },
  },

  "/api/admin/logout": {
    summary: "Invalidate the current admin session",
    post: {
      summary: "Log out",
      tags: ["admin"],
      responses: {
        "200": { description: "Logged out" },
      },
    },
  },

  "/api/admin/sites": {
    summary: "Manage Kody sites",
    get: {
      summary: "List all sites",
      tags: ["admin", "sites"],
      security: adminSecurity,
      responses: {
        "200": {
          description: "Array of redacted site configurations (secrets are not echoed back).",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/SiteConfigRead" },
              },
            },
          },
        },
        "401": { description: "Unauthenticated" },
      },
    },
    post: {
      summary: "Create a new site",
      tags: ["admin", "sites"],
      security: adminSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SiteConfig" },
          },
        },
      },
      responses: {
        "201": { description: "Site created" },
        "400": { description: "Invalid configuration" },
        "409": { description: "Site id already exists" },
      },
    },
  },

  "/api/admin/sites/{siteId}": {
    summary: "Read, update, or delete a site",
    parameters: [
      {
        name: "siteId",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[a-z0-9-]+$" },
      },
    ],
    get: {
      summary: "Fetch a site configuration",
      tags: ["admin", "sites"],
      security: adminSecurity,
      responses: {
        "200": {
          description: "Redacted site configuration (secrets are not echoed back).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SiteConfigRead" },
            },
          },
        },
        "404": { description: "Site not found" },
      },
    },
    put: {
      summary: "Update a site",
      tags: ["admin", "sites"],
      security: adminSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SiteConfig" },
          },
        },
      },
      responses: {
        "200": { description: "Site updated" },
        "404": { description: "Site not found" },
      },
    },
    delete: {
      summary: "Delete a site",
      tags: ["admin", "sites"],
      security: adminSecurity,
      responses: {
        "200": { description: "Site deleted" },
        "404": { description: "Site not found" },
      },
    },
  },

  "/api/admin/sites/{siteId}/scraping": {
    summary: "Inspect scrape results for a site",
    parameters: [
      {
        name: "siteId",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[a-z0-9-]+$" },
      },
    ],
    get: {
      summary: "List scrape results",
      tags: ["admin", "scraping"],
      security: adminSecurity,
      responses: {
        "200": { description: "Array of scrape results" },
      },
    },
  },

  "/api/admin/sites/{siteId}/scraping/{sourceIndex}/rescrape": {
    summary: "Re-run the scraper for one source",
    parameters: [
      {
        name: "siteId",
        in: "path",
        required: true,
        description: "Lowercase alphanumeric site identifier.",
        schema: { type: "string", pattern: "^[a-z0-9-]+$" },
      },
      {
        name: "sourceIndex",
        in: "path",
        required: true,
        description:
          "Zero-based index into the site's `knowledge.sources` array (see GET /api/admin/sites/:siteId/scraping for the current ordering).",
        schema: { type: "integer", minimum: 0 },
      },
    ],
    post: {
      summary: "Trigger a re-scrape",
      tags: ["admin", "scraping"],
      security: adminSecurity,
      responses: {
        "200": { description: "Scrape triggered" },
        "404": { description: "Source not found" },
      },
    },
  },

  "/api/admin/users": {
    summary: "Manage admin users",
    get: {
      summary: "List admin users",
      tags: ["admin", "users"],
      security: adminSecurity,
      responses: {
        "200": { description: "Array of users" },
      },
    },
    post: {
      summary: "Create an admin user",
      tags: ["admin", "users"],
      security: adminSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminCreateUser" },
          },
        },
      },
      responses: {
        "201": { description: "User created" },
        "409": { description: "Email already exists" },
      },
    },
  },

  "/api/admin/users/{userId}": {
    summary: "Delete an admin user",
    parameters: [
      { name: "userId", in: "path", required: true, schema: { type: "integer" } },
    ],
    delete: {
      summary: "Delete an admin user",
      tags: ["admin", "users"],
      security: adminSecurity,
      responses: {
        "200": { description: "User deleted" },
        "400": { description: "Cannot delete yourself" },
        "404": { description: "User not found" },
      },
    },
  },

  "/api/admin/logs": {
    summary: "Inspect and clear server logs",
    get: {
      summary: "List recent log entries",
      tags: ["admin", "logs"],
      security: adminSecurity,
      parameters: [
        { name: "level", in: "query", schema: { type: "string", enum: ["debug", "info", "warn", "error"] } },
        { name: "since", in: "query", description: "Epoch millis", schema: { type: "integer" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000 } },
      ],
      responses: {
        "200": { description: "Log entries" },
      },
    },
    delete: {
      summary: "Clear the in-memory log buffer",
      tags: ["admin", "logs"],
      security: adminSecurity,
      responses: {
        "200": { description: "Logs cleared" },
      },
    },
  },
};
