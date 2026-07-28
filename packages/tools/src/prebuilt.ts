/**
 * Pre-built tool factories.
 *
 * Each factory returns a `Tool` (definition + handler) that the `Toolkit` can
 * register. Callers supply auth/secrets at construction time, never at
 * call time, so the tool's closure is the auth boundary.
 */

import { z } from "zod";
import { httpCall, pluckPath } from "./http.js";
import type { Tool, ToolHandler, ToolHandlerResult } from "./types.js";

// -----------------------------------------------------------------------------
// httpGet / httpPost — generic HTTP tools driven by the agent's arguments.
// -----------------------------------------------------------------------------

const httpArgsSchema = z.object({
  url: z.string().url(),
  path: z.string().optional(),
  /** JSON-encoded object of query parameters. */
  query: z.string().optional(),
  /** JSON-encoded object of headers. */
  headers: z.string().optional(),
  body: z.unknown().optional(),
  /** Dotted path to extract from the JSON response. When set, the extracted value is the result. */
  jsonPath: z.string().optional(),
});

/**
 * GET tool. Use when the upstream is read-only.
 *
 * The definition is fixed; the agent supplies per-call `url`, optional
 * `path` suffix, `query`, and `jsonPath` extraction.
 */
export const httpGet: Tool = {
  definition: {
    type: "function",
    function: {
      name: "http_get",
      description:
        "Perform an HTTP GET. Required: url. Optional: path (appended to url), query params, headers, jsonPath (dotted path into the JSON response to return just that value).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to GET" },
          path: { type: "string", description: "Optional path appended to url" },
          query: {
            type: "string",
            description: "Optional query params as a JSON object (string-encoded)",
          },
          headers: {
            type: "string",
            description: "Optional headers as a JSON object (string-encoded)",
          },
          jsonPath: {
            type: "string",
            description: "Optional dotted path to extract from the JSON response",
          },
        },
        required: ["url"],
      },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const parsed = httpArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, message: `Invalid args: ${parsed.error.message}` };
    }
    const fullUrl = parsed.data.path
      ? `${parsed.data.url.replace(/\/+$/, "")}/${parsed.data.path.replace(/^\/+/, "")}`
      : parsed.data.url;

    let queryObj: Record<string, unknown> | undefined;
    if (parsed.data.query) {
      try {
        queryObj = JSON.parse(parsed.data.query);
      } catch {
        return { ok: false, message: "query must be a valid JSON object string" };
      }
    }
    let headersObj: Record<string, string> | undefined;
    if (parsed.data.headers) {
      try {
        headersObj = JSON.parse(parsed.data.headers);
      } catch {
        return { ok: false, message: "headers must be a valid JSON object string" };
      }
    }

    const result = await httpCall({
      url: fullUrl,
      method: "GET",
      headers: headersObj,
      body: queryObj,
    });
    if (!result.ok) {
      return { ok: false, message: `HTTP ${result.status}: ${result.text.slice(0, 500)}` };
    }
    if (parsed.data.jsonPath) {
      const extracted = pluckPath(result.json, parsed.data.jsonPath);
      return {
        ok: true,
        message: "ok",
        data: extracted,
      };
    }
    return { ok: true, message: "ok", data: result.json ?? result.text };
  },
};

/** POST tool. Same shape as httpGet, but the body is sent as JSON. */
export const httpPost: Tool = {
  definition: {
    type: "function",
    function: {
      name: "http_post",
      description:
        "Perform an HTTP POST with a JSON body. Required: url, body. Optional: path, headers, jsonPath.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to POST to" },
          path: { type: "string", description: "Optional path appended to url" },
          body: { type: "string", description: "JSON body to send (string-encoded)" },
          headers: {
            type: "string",
            description: "Optional headers as a JSON object (string-encoded)",
          },
          jsonPath: {
            type: "string",
            description: "Optional dotted path to extract from the JSON response",
          },
        },
        required: ["url", "body"],
      },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const raw = args as { url?: unknown; body?: unknown; path?: unknown; headers?: unknown; jsonPath?: unknown };
    if (typeof raw.url !== "string" || typeof raw.body !== "string") {
      return { ok: false, message: "url and body are required strings" };
    }
    let bodyObj: unknown;
    try {
      bodyObj = JSON.parse(raw.body);
    } catch {
      return { ok: false, message: "body must be a valid JSON string" };
    }
    let headersObj: Record<string, string> | undefined;
    if (typeof raw.headers === "string" && raw.headers.length > 0) {
      try {
        headersObj = JSON.parse(raw.headers);
      } catch {
        return { ok: false, message: "headers must be a valid JSON object string" };
      }
    }

    const fullUrl = typeof raw.path === "string" && raw.path
      ? `${raw.url.replace(/\/+$/, "")}/${raw.path.replace(/^\/+/, "")}`
      : raw.url;

    const result = await httpCall({ url: fullUrl, method: "POST", headers: headersObj, body: bodyObj });
    if (!result.ok) {
      return { ok: false, message: `HTTP ${result.status}: ${result.text.slice(0, 500)}` };
    }
    if (typeof raw.jsonPath === "string" && raw.jsonPath) {
      return { ok: true, message: "ok", data: pluckPath(result.json, raw.jsonPath) };
    }
    return { ok: true, message: "ok", data: result.json ?? result.text };
  },
};

// -----------------------------------------------------------------------------
// webhook — POST a signed payload to an arbitrary URL.
// -----------------------------------------------------------------------------

export interface WebhookOptions {
  /** HMAC-SHA256 secret. When set, the body is signed in `X-Kody-Signature`. */
  secret?: string;
  /** Optional static headers merged into every call. */
  headers?: Record<string, string>;
  /** Optional bearer or api-key auth applied to every call. */
  auth?: { type: "bearer" | "apiKey"; value: string; headerName?: string };
  /** Optional retry policy. */
  retry?: { maxAttempts: number; baseDelayMs: number };
}

/**
 * Build a tool that POSTs a JSON payload to a fixed URL. Useful for
 * integrating with Zapier, Make, n8n, IFTTT, or any HTTPS receiver.
 *
 * The agent supplies per-call `payload` (any JSON-encodable object); the URL,
 * secret, and headers are baked in at construction time.
 */
export function webhook(url: string, options: WebhookOptions = {}): Tool {
  return {
    definition: {
      type: "function",
      function: {
        name: "webhook",
        description: `POST a JSON payload to ${url}. The agent supplies the "payload" object.`,
        parameters: {
          type: "object",
          properties: {
            payload: {
              type: "string",
              description: "JSON object to send as the request body (string-encoded)",
            },
          },
          required: ["payload"],
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const raw = args as { payload?: unknown };
      if (typeof raw.payload !== "string") {
        return { ok: false, message: "payload is required (JSON-encoded string)" };
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.payload);
      } catch {
        return { ok: false, message: "payload must be a valid JSON string" };
      }
      const result = await httpCall({
        url,
        method: "POST",
        headers: options.headers,
        body,
        secret: options.secret,
        auth: options.auth,
        retry: options.retry,
      });
      if (!result.ok) {
        return { ok: false, message: `Webhook returned ${result.status}: ${result.text.slice(0, 300)}` };
      }
      const ok: ToolHandlerResult = { ok: true, message: "Webhook delivered", data: result.json ?? result.text };
      return ok;
    },
  };
}

// -----------------------------------------------------------------------------
// slack — post a message to a Slack channel via chat.postMessage.
// -----------------------------------------------------------------------------

export interface SlackOptions {
  /** Bot OAuth token (xoxb-...). Required. */
  token: string;
  /** Channel ID or name (#general). Required. */
  channel: string;
}

/**
 * Build a tool that posts a message to a Slack channel. Uses the
 * chat.postMessage Web API. The agent supplies the `text` argument.
 */
export function slack(options: SlackOptions): Tool {
  return {
    definition: {
      type: "function",
      function: {
        name: "slack_post_message",
        description: `Post a message to Slack channel ${options.channel}.`,
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "Message text (supports Slack mrkdwn)" },
          },
          required: ["text"],
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const text = typeof args.text === "string" ? args.text : "";
      if (!text) return { ok: false, message: "text is required" };
      const result = await httpCall({
        url: "https://slack.com/api/chat.postMessage",
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: { channel: options.channel, text },
        auth: { type: "bearer", value: options.token },
      });
      const body = (result.json ?? {}) as { ok?: boolean; ts?: string; error?: string };
      if (!result.ok || body.ok === false) {
        return {
          ok: false,
          message: `Slack API error: ${body.error ?? result.text.slice(0, 200)}`,
        };
      }
      return { ok: true, id: body.ts, message: `Message posted to ${options.channel}` };
    },
  };
}

// -----------------------------------------------------------------------------
// linear — create an issue in a Linear team.
// -----------------------------------------------------------------------------

export interface LinearOptions {
  /** Linear API key (lin_api_...). Required. */
  apiKey: string;
  /** Linear team UUID. Required. */
  teamId: string;
  /** Default label IDs to apply. */
  labelIds?: string[];
}

const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

const ISSUE_CREATE_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`;

/**
 * Build a tool that creates a Linear issue. The agent supplies `title`,
 * optional `description`, and optional `labelIds` (in addition to the
 * defaults baked into the closure).
 */
export function linear(options: LinearOptions): Tool {
  return {
    definition: {
      type: "function",
      function: {
        name: "linear_create_issue",
        description: `Create an issue in Linear team ${options.teamId}.`,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Issue title" },
            description: { type: "string", description: "Issue description (plain text)" },
            labelIds: {
              type: "string",
              description: "Optional array of label IDs as a JSON string; merged with defaults",
            },
          },
          required: ["title"],
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const title = typeof args.title === "string" ? args.title : "";
      if (!title) return { ok: false, message: "title is required" };
      const description = typeof args.description === "string" ? args.description : "";
      let extraLabels: string[] = [];
      if (typeof args.labelIds === "string" && args.labelIds.length > 0) {
        try {
          const parsed = JSON.parse(args.labelIds);
          if (Array.isArray(parsed)) extraLabels = parsed.map(String);
        } catch {
          return { ok: false, message: "labelIds must be a JSON-encoded array" };
        }
      }
      const labelIds = [...(options.labelIds ?? []), ...extraLabels];
      const result = await httpCall({
        url: LINEAR_GRAPHQL,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          query: ISSUE_CREATE_MUTATION,
          variables: { input: { teamId: options.teamId, title, description, labelIds } },
        },
        auth: { type: "bearer", value: options.apiKey },
      });
      if (!result.ok) {
        return { ok: false, message: `Linear API returned ${result.status}: ${result.text.slice(0, 300)}` };
      }
      const body = (result.json ?? {}) as {
        data?: { issueCreate?: { success?: boolean; issue?: { identifier?: string; url?: string } } };
        errors?: Array<{ message: string }>;
      };
      if (body.errors?.length) {
        return { ok: false, message: `Linear: ${body.errors.map((e) => e.message).join("; ")}` };
      }
      const issue = body.data?.issueCreate?.issue;
      if (!body.data?.issueCreate?.success || !issue) {
        return { ok: false, message: "Linear: issue creation failed" };
      }
      return {
        ok: true,
        id: issue.identifier,
        message: `Linear issue ${issue.identifier} created`,
        data: { url: issue.url },
      };
    },
  };
}

// -----------------------------------------------------------------------------
// sendgridEmail — send a transactional email via SendGrid's v3 API.
// -----------------------------------------------------------------------------

export interface SendgridEmailOptions {
  /** SendGrid API key (SG....). Required. */
  apiKey: string;
  /** Default "from" address. */
  from: string;
  /** Optional default "reply-to". */
  replyTo?: string;
}

/**
 * Build a tool that sends a transactional email via the SendGrid v3 API.
 * The agent supplies per-call `to`, `subject`, and `text`/`html`.
 */
export function sendgridEmail(options: SendgridEmailOptions): Tool {
  return {
    definition: {
      type: "function",
      function: {
        name: "sendgrid_send_email",
        description: "Send a transactional email through SendGrid.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address" },
            subject: { type: "string", description: "Email subject line" },
            text: { type: "string", description: "Plain-text body" },
            html: { type: "string", description: "Optional HTML body" },
          },
          required: ["to", "subject", "text"],
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const to = typeof args.to === "string" ? args.to : "";
      const subject = typeof args.subject === "string" ? args.subject : "";
      const text = typeof args.text === "string" ? args.text : "";
      const html = typeof args.html === "string" ? args.html : undefined;
      if (!to || !subject || !text) {
        return { ok: false, message: "to, subject, and text are required" };
      }
      const personalizations = [{ to: [{ email: to }], subject }];
      const content: Array<{ type: string; value: string }> = [{ type: "text/plain", value: text }];
      if (html) content.push({ type: "text/html", value: html });
      const payload = {
        personalizations,
        from: { email: options.from },
        content,
        ...(options.replyTo ? { reply_to: { email: options.replyTo } } : {}),
      };
      const result = await httpCall({
        url: "https://api.sendgrid.com/v3/mail/send",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        auth: { type: "bearer", value: options.apiKey },
      });
      if (!result.ok && result.status !== 202) {
        return { ok: false, message: `SendGrid ${result.status}: ${result.text.slice(0, 300)}` };
      }
      return { ok: true, message: `Email sent to ${to}` };
    },
  };
}
