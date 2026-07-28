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

  it("stays in sync with the build function", () => {
    // Re-run the build function and dump it; the parsed result should
    // match the parsed committed file. Comparing parsed objects (rather
    // than raw text) avoids noise from key ordering, whitespace, and
    // trailing newlines that don't change the document's meaning.
    const text = readFileSync(openapiYamlPath, "utf8");
    const parsed = yaml.load(text);
    const regenerated = yaml.dump(buildOpenApiSpec(), {
      lineWidth: 120,
      noRefs: true,
      flowLevel: -1,
      sortKeys: false,
    });
    const reparsed = yaml.load(regenerated);
    expect(reparsed).toEqual(parsed);
  });
});
