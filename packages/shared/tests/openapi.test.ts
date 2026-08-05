import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import yaml from "js-yaml";
import { buildOpenApiSpec } from "../src/openapi/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const openapiYamlPath = path.resolve(here, "..", "openapi.yaml");

describe("OpenAPI generator", () => {
  it("produces a spec that the build function can re-emit consistently", () => {
    const a = buildOpenApiSpec();
    const b = buildOpenApiSpec();
    expect(yaml.dump(a)).toBe(yaml.dump(b));
  });

  it("emits the canonical openapi 3.1 header", () => {
    const spec = buildOpenApiSpec() as { openapi: string; info: { title: string; version: string } };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Kody API");
    expect(spec.info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("documents every required path", () => {
    const spec = buildOpenApiSpec() as { paths: Record<string, unknown> };
    const required = [
      "/health",
      "/api/config/{siteId}",
      "/api/chat",
      "/api/tickets",
      "/api/sessions/{sessionId}",
      "/api/feedback",
      "/api/admin/login",
      "/api/admin/sites",
      "/api/admin/sites/{siteId}",
      "/api/admin/users",
      "/api/admin/logs",
    ];
    for (const p of required) {
      expect(spec.paths[p], `path ${p} should be documented`).toBeDefined();
    }
  });

  it("maps the SiteConfig Zod schema into a typed component", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const siteConfig = spec.components.schemas.SiteConfig;
    expect(siteConfig).toBeDefined();
    expect(siteConfig.type).toBe("object");
    const props = (siteConfig.properties as Record<string, Record<string, unknown>>) ?? {};
    expect(props.siteId).toBeDefined();
    expect(props.allowedOrigins).toBeDefined();
    expect(props.ai).toBeDefined();
    expect(props.guardrails).toBeDefined();
    expect((props.siteId as { pattern: string }).pattern).toBe("^[a-z0-9-]+$");
  });

  it("exposes a redacted SiteConfig read model that masks secrets", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const read = spec.components.schemas.SiteConfigRead;
    expect(read).toBeDefined();
    const ai = ((read.properties as Record<string, Record<string, unknown>>).ai ?? {}) as Record<string, unknown>;
    const aiProps = (ai.properties as Record<string, Record<string, unknown>>) ?? {};
    // The AI apiKey is masked — the description tells consumers not to rely
    // on this field for the real value.
    expect(aiProps.apiKey).toBeDefined();
    expect((aiProps.apiKey as { description: string }).description).toMatch(/Redacted/);
  });

  it("redacts every ticket-provider secret in the SiteConfig read model", () => {
    // The admin GET responses for /api/admin/sites and
    // /api/admin/sites/{siteId} both reference SiteConfigRead, so every
    // branch in the providers oneOf must have its credential field
    // replaced with a redacted placeholder. This guards against a future
    // schema rename (e.g. someone changing `apiToken` to `token`) silently
    // slipping a real secret back into the read path.
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const read = spec.components.schemas.SiteConfigRead;
    const tickets = ((read.properties as Record<string, Record<string, unknown>>).tickets ?? {}) as Record<string, unknown>;
    const ticketsProps = (tickets.properties as Record<string, Record<string, unknown>>) ?? {};
    const providers = (ticketsProps.providers as Record<string, unknown> | undefined) ?? {};
    const providerItems = (providers.items as Record<string, unknown> | undefined) ?? {};
    const branches = (providerItems.oneOf as Array<Record<string, unknown>> | undefined) ?? [];
    // One branch per provider (jira, github, linear, email, webhook).
    expect(branches.length).toBeGreaterThanOrEqual(5);

    // Map each provider enum value to the field on its branch that holds
    // the secret material we expect to be redacted.
    const expected: Array<{ provider: string; field: string }> = [
      { provider: "jira", field: "apiToken" },
      { provider: "github", field: "token" },
      { provider: "linear", field: "apiKey" },
      { provider: "email", field: "smtpPass" },
      { provider: "webhook", field: "secret" },
    ];

    for (const { provider, field } of expected) {
      const branch = branches.find((b) => {
        const props = (b.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
        const providerEnum = ((props.provider as { enum?: string[] } | undefined)?.enum ?? []) as string[];
        return providerEnum.includes(provider);
      });
      expect(branch, `branch for provider "${provider}" should be documented`).toBeDefined();
      const branchProps = ((branch as Record<string, unknown>).properties as Record<string, Record<string, unknown>>) ?? {};
      const fieldSchema = branchProps[field];
      expect(fieldSchema, `secret field "${field}" on ${provider} branch should be documented`).toBeDefined();
      expect((fieldSchema as { description?: string }).description).toMatch(/Redacted/);
    }
  });

  it("emits named KnowledgeSource union branches", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    expect(spec.components.schemas.KnowledgeSourceText).toBeDefined();
    expect(spec.components.schemas.KnowledgeSourceUrl).toBeDefined();
    expect(spec.components.schemas.KnowledgeSourceFile).toBeDefined();
    expect(spec.components.schemas.KnowledgeSourceFaq).toBeDefined();
  });

  it("emits named TicketProvider union branches", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    expect(spec.components.schemas.TicketProviderJira).toBeDefined();
    expect(spec.components.schemas.TicketProviderGithub).toBeDefined();
    expect(spec.components.schemas.TicketProviderLinear).toBeDefined();
    expect(spec.components.schemas.TicketProviderEmail).toBeDefined();
    expect(spec.components.schemas.TicketProviderWebhook).toBeDefined();
  });

  it("emits a CustomTool component derived from the Zod schema", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const tool = spec.components.schemas.CustomTool;
    expect(tool).toBeDefined();
    expect(tool.type).toBe("object");
    // The required array must reflect the actual Zod schema (no defaults).
    const required = (tool.required as string[] | undefined) ?? [];
    expect(required).toEqual(expect.arrayContaining(["name", "description", "parameters", "endpoint"]));
  });

  it("maps the KnowledgeSource discriminated union with a discriminator", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const knowledgeSource = spec.components.schemas.KnowledgeSource;
    expect(knowledgeSource).toBeDefined();
    expect(knowledgeSource.oneOf).toBeDefined();
    expect(Array.isArray(knowledgeSource.oneOf)).toBe(true);
    expect((knowledgeSource.oneOf as unknown[]).length).toBeGreaterThanOrEqual(4);
    expect(knowledgeSource.discriminator).toEqual({ propertyName: "type" });
  });

  it("maps the TicketProvider discriminated union with a discriminator", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const ticketProvider = spec.components.schemas.TicketProvider;
    expect(ticketProvider).toBeDefined();
    expect(ticketProvider.oneOf).toBeDefined();
    expect(Array.isArray(ticketProvider.oneOf)).toBe(true);
    expect((ticketProvider.oneOf as unknown[]).length).toBeGreaterThanOrEqual(5);
    expect(ticketProvider.discriminator).toEqual({ propertyName: "provider" });
  });

  it("requires x-kody-site-id on every widget-facing operation", () => {
    const spec = buildOpenApiSpec() as {
      paths: Record<string, { get?: { parameters?: Array<{ name: string; in: string }> }; post?: { parameters?: Array<{ name: string; in: string }> }; delete?: { parameters?: Array<{ name: string; in: string }> } }>;
    };
    const widgetOps: Array<[string, string]> = [
      ["/api/config/{siteId}", "get"],
      ["/api/chat", "post"],
      ["/api/tickets", "post"],
      ["/api/sessions/{sessionId}", "delete"],
      ["/api/feedback", "post"],
    ];
    for (const [path, method] of widgetOps) {
      const op = spec.paths[path]?.[method as "get" | "post" | "delete"];
      expect(op, `operation ${method.toUpperCase()} ${path} should exist`).toBeDefined();
      const params = op?.parameters ?? [];
      const header = params.find((p) => p.name === "x-kody-site-id" && p.in === "header");
      expect(header, `${method.toUpperCase()} ${path} must declare x-kody-site-id header`).toBeDefined();
    }
  });

  it("ToolsConfig has no required fields (all are .default() or .optional())", () => {
    // Every property on toolsSchema either has a Zod default or is optional,
    // so the outer `required` array should be absent or empty.
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const tools = spec.components.schemas.ToolsConfig;
    expect(tools).toBeDefined();
    const required = (tools.required as string[] | undefined) ?? [];
    expect(required).toEqual([]);
  });

  it("SiteConfig requires exactly the four non-defaulted top-level fields", () => {
    // siteId, allowedOrigins, ai, guardrails are the only SiteConfig fields
    // without a Zod default. Everything else (branding, knowledge, tickets,
    // tools, rateLimit, personality, compliance, conversationStarters,
    // enabled) is either defaulted or wrapped in .default().
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    const siteConfig = spec.components.schemas.SiteConfig;
    expect(siteConfig).toBeDefined();
    const required = (siteConfig.required as string[] | undefined) ?? [];
    expect(required).toEqual(["siteId", "allowedOrigins", "ai", "guardrails"]);
  });

  it("documents bearer + cookie auth under components.securitySchemes", () => {
    const spec = buildOpenApiSpec() as {
      components: { securitySchemes: Record<string, Record<string, string>> };
    };
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth.type).toBe("http");
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(spec.components.securitySchemes.sessionCookie).toBeDefined();
  });
});

describe("packages/shared/openapi.yaml", () => {
  it("is a parseable YAML document", () => {
    const text = readFileSync(openapiYamlPath, "utf8");
    const parsed = yaml.load(text) as { openapi?: string };
    expect(parsed.openapi).toBe("3.1.0");
  });

  it("contains every required path key", () => {
    const text = readFileSync(openapiYamlPath, "utf8");
    const required = [
      "/health:",
      "/api/config/{siteId}:",
      "/api/chat:",
      "/api/admin/sites:",
      "/api/admin/sites/{siteId}:",
    ];
    for (const needle of required) {
      expect(text, `expected to find \`${needle}\` in openapi.yaml`).toContain(needle);
    }
  });

  it("stays in sync with the build function (text-level)", () => {
    // Byte-level compare so any drift in formatting, ordering, or
    // comment placement trips the test. Run `pnpm --filter @kody/shared
    // generate:openapi` to update the committed file if this fails for
    // an intentional reason.
    const text = readFileSync(openapiYamlPath, "utf8");
    const regenerated = yaml.dump(buildOpenApiSpec(), {
      lineWidth: 120,
      noRefs: true,
      flowLevel: -1,
      sortKeys: false,
    });
    expect(regenerated).toBe(text);
  });
});
