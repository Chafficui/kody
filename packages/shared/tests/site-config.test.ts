import { describe, it, expect } from "vitest";
import { siteConfigSchema, toPublicConfig } from "../src/validators/site-config.js";

const validMinimalConfig = {
  siteId: "test-site",
  allowedOrigins: ["https://example.com"],
  ai: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
  },
  guardrails: {
    allowedTopics: ["billing", "support"],
    topicDescription: "Help with billing and technical support.",
  },
};

describe("siteConfigSchema", () => {
  it("accepts a valid minimal config and applies defaults", () => {
    const result = siteConfigSchema.parse(validMinimalConfig);

    expect(result.siteId).toBe("test-site");
    expect(result.allowedOrigins).toEqual(["https://example.com"]);
    expect(result.enabled).toBe(true);

    expect(result.branding.name).toBe("Assistant");
    expect(result.branding.colors.primary).toBe("#6366f1");
    expect(result.branding.position).toBe("bottom-right");
    expect(result.branding.welcomeMessage).toBe("Hi! How can I help you today?");

    expect(result.ai.apiKey).toBe("ollama");
    expect(result.ai.temperature).toBe(0.7);
    expect(result.ai.maxTokens).toBe(1024);

    expect(result.guardrails.enablePromptInjectionDetection).toBe(true);
    expect(result.guardrails.enableOutputScrubbing).toBe(true);
    expect(result.guardrails.maxInputLength).toBe(2000);
    expect(result.guardrails.blockedInputPatterns).toEqual([]);

    expect(result.knowledge.sources).toEqual([]);
    expect(result.knowledge.maxContextTokens).toBe(4000);

    expect(result.tickets.enabled).toBe(false);
    expect(result.tickets.requiredFields).toEqual(["email", "description"]);

    expect(result.rateLimit.messagesPerMinute).toBe(10);
    expect(result.rateLimit.messagesPerHour).toBe(100);
    expect(result.rateLimit.messagesPerDay).toBe(1000);
  });

  it("accepts a fully specified config", () => {
    const full = {
      ...validMinimalConfig,
      branding: {
        name: "HelpBot",
        tagline: "We help you!",
        colors: {
          primary: "#ff0000",
          primaryForeground: "#ffffff",
          background: "#000000",
          foreground: "#ffffff",
          bubbleBackground: "#333333",
          userBubbleBackground: "#ff0000",
          userBubbleForeground: "#ffffff",
        },
        position: "bottom-left" as const,
        welcomeMessage: "Hello!",
        inputPlaceholder: "Ask away...",
      },
      ai: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-123",
        model: "gpt-4o",
        temperature: 0.5,
        maxTokens: 2048,
        topP: 0.9,
        systemPromptPrefix: "Be concise.",
      },
      enabled: false,
    };

    const result = siteConfigSchema.parse(full);
    expect(result.branding.name).toBe("HelpBot");
    expect(result.branding.position).toBe("bottom-left");
    expect(result.ai.apiKey).toBe("sk-test-123");
    expect(result.ai.topP).toBe(0.9);
    expect(result.enabled).toBe(false);
  });

  describe("siteId validation", () => {
    it("rejects uppercase characters", () => {
      expect(() => siteConfigSchema.parse({ ...validMinimalConfig, siteId: "TestSite" })).toThrow();
    });

    it("rejects spaces", () => {
      expect(() =>
        siteConfigSchema.parse({ ...validMinimalConfig, siteId: "test site" }),
      ).toThrow();
    });

    it("rejects special characters", () => {
      expect(() =>
        siteConfigSchema.parse({ ...validMinimalConfig, siteId: "test_site" }),
      ).toThrow();
    });

    it("accepts hyphens", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        siteId: "my-test-site",
      });
      expect(result.siteId).toBe("my-test-site");
    });

    it("rejects empty string", () => {
      expect(() => siteConfigSchema.parse({ ...validMinimalConfig, siteId: "" })).toThrow();
    });
  });

  describe("allowedOrigins validation", () => {
    it("rejects empty array", () => {
      expect(() => siteConfigSchema.parse({ ...validMinimalConfig, allowedOrigins: [] })).toThrow();
    });

    it("rejects non-URL strings", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          allowedOrigins: ["not-a-url"],
        }),
      ).toThrow();
    });

    it("accepts multiple origins", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        allowedOrigins: ["https://example.com", "https://staging.example.com"],
      });
      expect(result.allowedOrigins).toHaveLength(2);
    });
  });

  describe("branding validation", () => {
    it("rejects invalid hex colors", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          branding: { colors: { primary: "red" } },
        }),
      ).toThrow();
    });

    it("rejects 3-digit hex colors", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          branding: { colors: { primary: "#f00" } },
        }),
      ).toThrow();
    });
  });

  describe("ai provider validation", () => {
    it("rejects missing baseUrl", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          ai: { model: "llama3.2" },
        }),
      ).toThrow();
    });

    it("rejects missing model", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          ai: { baseUrl: "http://localhost:11434/v1" },
        }),
      ).toThrow();
    });

    it("rejects temperature above 2", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          ai: { ...validMinimalConfig.ai, temperature: 3 },
        }),
      ).toThrow();
    });

    it("rejects negative temperature", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          ai: { ...validMinimalConfig.ai, temperature: -1 },
        }),
      ).toThrow();
    });
  });

  describe("guardrails validation", () => {
    it("requires at least one allowed topic", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          guardrails: {
            allowedTopics: [],
            topicDescription: "Test",
          },
        }),
      ).toThrow();
    });

    it("requires a topic description", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          guardrails: {
            allowedTopics: ["billing"],
          },
        }),
      ).toThrow();
    });
  });

  describe("knowledge sources validation", () => {
    it("accepts text knowledge", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        knowledge: {
          sources: [{ type: "text", title: "FAQ", content: "Some content" }],
        },
      });
      expect(result.knowledge.sources).toHaveLength(1);
      expect(result.knowledge.sources[0]!.type).toBe("text");
    });

    it("accepts FAQ knowledge", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        knowledge: {
          sources: [
            {
              type: "faq",
              entries: [{ question: "What is Kody?", answer: "A chat widget." }],
            },
          ],
        },
      });
      expect(result.knowledge.sources).toHaveLength(1);
    });

    it("accepts URL knowledge", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        knowledge: {
          sources: [{ type: "url", url: "https://example.com/docs" }],
        },
      });
      expect(result.knowledge.sources).toHaveLength(1);
    });

    it("accepts file knowledge", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        knowledge: {
          sources: [{ type: "file", filePath: "docs/faq.md" }],
        },
      });
      expect(result.knowledge.sources).toHaveLength(1);
    });

    it("rejects unknown knowledge type", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          knowledge: {
            sources: [{ type: "unknown", data: "test" }],
          },
        }),
      ).toThrow();
    });
  });

  describe("ticket providers validation", () => {
    it("accepts jira provider", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        tickets: {
          enabled: true,
          providers: [
            {
              provider: "jira",
              baseUrl: "https://mycompany.atlassian.net",
              projectKey: "SUP",
              apiToken: "token-123",
              email: "bot@company.com",
            },
          ],
        },
      });
      expect(result.tickets.enabled).toBe(true);
      expect(result.tickets.providers).toHaveLength(1);
    });

    it("accepts github provider", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        tickets: {
          enabled: true,
          providers: [
            {
              provider: "github",
              owner: "myorg",
              repo: "support",
              token: "ghp_abc123",
            },
          ],
        },
      });
      expect(result.tickets.providers[0]!.provider).toBe("github");
    });

    it("accepts webhook provider", () => {
      const result = siteConfigSchema.parse({
        ...validMinimalConfig,
        tickets: {
          enabled: true,
          providers: [
            {
              provider: "webhook",
              url: "https://hooks.example.com/tickets",
            },
          ],
        },
      });
      expect(result.tickets.providers[0]!.provider).toBe("webhook");
    });
  });

  describe("rate limit validation", () => {
    it("rejects zero messages per minute", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          rateLimit: { messagesPerMinute: 0 },
        }),
      ).toThrow();
    });

    it("rejects exceeding max messages per minute", () => {
      expect(() =>
        siteConfigSchema.parse({
          ...validMinimalConfig,
          rateLimit: { messagesPerMinute: 121 },
        }),
      ).toThrow();
    });
  });
});

describe("toPublicConfig", () => {
  it("strips sensitive fields from config", () => {
    const full = siteConfigSchema.parse({
      ...validMinimalConfig,
      ai: {
        baseUrl: "http://localhost:11434/v1",
        apiKey: "secret-key",
        model: "llama3.2",
      },
      tickets: {
        enabled: true,
        providers: [
          {
            provider: "github",
            owner: "org",
            repo: "repo",
            token: "secret-token",
          },
        ],
      },
    });

    const pub = toPublicConfig(full);

    expect(pub.siteId).toBe("test-site");
    expect(pub.branding.name).toBe("Assistant");
    expect(pub.tickets.enabled).toBe(true);

    expect((pub as Record<string, unknown>)["ai"]).toBeUndefined();
    expect((pub as Record<string, unknown>)["guardrails"]).toBeUndefined();
    expect((pub as Record<string, unknown>)["knowledge"]).toBeUndefined();
    expect((pub.tickets as Record<string, unknown>)["providers"]).toBeUndefined();
  });
});
