import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color");

export const brandingSchema = z.object({
  name: z.string().min(1).max(100).default("Assistant"),
  tagline: z.string().max(200).optional(),
  logoUrl: z.string().url().optional(),
  colors: z
    .object({
      primary: hexColor.default("#6366f1"),
      primaryForeground: hexColor.default("#ffffff"),
      background: hexColor.default("#ffffff"),
      foreground: hexColor.default("#1f2937"),
      bubbleBackground: hexColor.default("#f3f4f6"),
      userBubbleBackground: hexColor.default("#6366f1"),
      userBubbleForeground: hexColor.default("#ffffff"),
    })
    .default({}),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
  welcomeMessage: z.string().max(500).default("Hi! How can I help you today?"),
  inputPlaceholder: z.string().max(200).default("Type your message..."),
});

export const aiProviderSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).default("ollama"),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(32768).default(1024),
  topP: z.number().min(0).max(1).optional(),
  systemPromptPrefix: z.string().max(4000).optional(),
});

export const guardrailsSchema = z.object({
  allowedTopics: z.array(z.string().min(1).max(200)).min(1),
  topicDescription: z.string().min(1).max(4000),
  refusalMessage: z
    .string()
    .max(500)
    .default(
      "I can only help with topics related to this website. Is there something else I can assist you with?",
    ),
  blockedInputPatterns: z.array(z.string()).default([]),
  blockedOutputPatterns: z.array(z.string()).default([]),
  maxInputLength: z.number().int().min(1).max(10000).default(2000),
  enablePromptInjectionDetection: z.boolean().default(true),
  enableOutputScrubbing: z.boolean().default(true),
});

const textKnowledgeSchema = z.object({
  type: z.literal("text"),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  url: z.string().url().optional(),
});

const urlKnowledgeSchema = z.object({
  type: z.literal("url"),
  url: z.string().url(),
  title: z.string().max(200).optional(),
  refreshIntervalHours: z.number().int().min(1).max(720).default(24),
  enableJsRendering: z.boolean().default(true),
});

const fileKnowledgeSchema = z.object({
  type: z.literal("file"),
  filePath: z.string().min(1),
  title: z.string().max(200).optional(),
});

const faqKnowledgeSchema = z.object({
  type: z.literal("faq"),
  entries: z
    .array(
      z.object({
        question: z.string().min(1).max(500),
        answer: z.string().min(1).max(5000),
      }),
    )
    .min(1),
  url: z.string().url().optional(),
});

export const knowledgeSourceSchema = z.discriminatedUnion("type", [
  textKnowledgeSchema,
  urlKnowledgeSchema,
  fileKnowledgeSchema,
  faqKnowledgeSchema,
]);

export const knowledgeSchema = z.object({
  sources: z.array(knowledgeSourceSchema).default([]),
  maxContextTokens: z.number().int().min(100).max(32000).default(4000),
});

const jiraProviderSchema = z.object({
  provider: z.literal("jira"),
  baseUrl: z.string().url(),
  projectKey: z.string().min(1),
  apiToken: z.string().min(1),
  email: z.string().email(),
  issueType: z.string().default("Task"),
});

const githubProviderSchema = z.object({
  provider: z.literal("github"),
  owner: z.string().min(1),
  repo: z.string().min(1),
  token: z.string().min(1),
  labels: z.array(z.string()).default(["kody-ticket"]),
});

const linearProviderSchema = z.object({
  provider: z.literal("linear"),
  apiKey: z.string().min(1),
  teamId: z.string().min(1),
  labelIds: z.array(z.string()).default([]),
});

const emailProviderSchema = z.object({
  provider: z.literal("email"),
  to: z.string().email(),
  from: z.string().email().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
});

const webhookProviderSchema = z.object({
  provider: z.literal("webhook"),
  url: z.string().url(),
  method: z.enum(["POST", "PUT"]).default("POST"),
  headers: z.record(z.string()).default({}),
  secret: z.string().optional(),
});

export const ticketProviderSchema = z.discriminatedUnion("provider", [
  jiraProviderSchema,
  githubProviderSchema,
  linearProviderSchema,
  emailProviderSchema,
  webhookProviderSchema,
]);

export const ticketsSchema = z.object({
  enabled: z.boolean().default(false),
  promptMessage: z
    .string()
    .max(500)
    .default("Would you like me to create a support ticket for this issue?"),
  providers: z.array(ticketProviderSchema).default([]),
  requiredFields: z
    .array(z.enum(["name", "email", "subject", "description"]))
    .default(["email", "description"]),
});

export const rateLimitSchema = z.object({
  messagesPerMinute: z.number().int().min(1).max(120).default(10),
  messagesPerHour: z.number().int().min(1).max(1000).default(100),
  messagesPerDay: z.number().int().min(1).max(10000).default(1000),
});

export const siteConfigSchema = z.object({
  siteId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Must be lowercase alphanumeric with hyphens"),
  allowedOrigins: z.array(z.string().url()).min(1),
  branding: brandingSchema.default({}),
  ai: aiProviderSchema,
  guardrails: guardrailsSchema,
  knowledge: knowledgeSchema.default({}),
  tickets: ticketsSchema.default({}),
  rateLimit: rateLimitSchema.default({}),
  enabled: z.boolean().default(true),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type BrandingConfig = z.infer<typeof brandingSchema>;
export type AiProviderConfig = z.infer<typeof aiProviderSchema>;
export type GuardrailsConfig = z.infer<typeof guardrailsSchema>;
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type KnowledgeConfig = z.infer<typeof knowledgeSchema>;
export type TicketProvider = z.infer<typeof ticketProviderSchema>;
export type TicketsConfig = z.infer<typeof ticketsSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitSchema>;

export const publicBrandingSchema = brandingSchema;

export const publicSiteConfigSchema = z.object({
  siteId: z.string(),
  branding: publicBrandingSchema,
  tickets: z.object({
    enabled: z.boolean(),
    promptMessage: z.string(),
    requiredFields: z.array(z.string()),
  }),
  sourceUrls: z.record(z.string(), z.string()).optional(),
});

export type PublicSiteConfig = z.infer<typeof publicSiteConfigSchema>;

export function toPublicConfig(config: SiteConfig): PublicSiteConfig {
  const sourceUrls: Record<string, string> = {};
  let idx = 1;
  for (const source of config.knowledge.sources) {
    if ("url" in source && typeof source.url === "string") {
      sourceUrls[String(idx)] = source.url;
    }
    idx++;
  }

  return {
    siteId: config.siteId,
    branding: config.branding,
    tickets: {
      enabled: config.tickets.enabled,
      promptMessage: config.tickets.promptMessage,
      requiredFields: config.tickets.requiredFields,
    },
    ...(Object.keys(sourceUrls).length > 0 ? { sourceUrls } : {}),
  };
}
