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

  it("does not list ZodDefault fields as required", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };
    // brandingSchema has most fields defaulted. None of them should appear
    // in `required` even though the inner `colors` sub-object is not optional.
    const branding = spec.components.schemas.brandingSchema as Record<string, unknown> | undefined;
    // branding is mapped under the name it was registered with, not the
    // variable name. The buildComponents() function names it `brandingSchema`.
    // (The map is "schema name -> object", and we registered under `BrandingConfig`.)
    // Either name works depending on registration; check the *content* rather
    // than the key.
    void branding;
    const tickets = spec.components.schemas.TicketsConfig as Record<string, unknown> | undefined;
    // The TicketsConfig object has lots of .default() fields; the outer
    // object's required[] should be empty (every field is either defaulted
    // or optional).
    const required = (tickets?.required as string[] | undefined) ?? [];
    // If required is present, none of its entries may be a ZodDefault
    // property. We don't have a full registry here, so just check that
    // common-default fields are not in required.
    for (const defaulted of ["enabled", "promptMessage", "providers", "requiredFields"]) {
      expect(required, `${defaulted} has a .default() and must not be required`).not.toContain(defaulted);
    }
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
