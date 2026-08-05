import type { SiteStore } from "./services/site-store.js";
import type { Env } from "./env.js";

/**
 * Default localhost ports seeded into the demo site's `allowedOrigins`
 * alongside `http://localhost:${PORT}`. These cover the most common
 * dev-server ports across Vite, Next.js, create-react-app, and the
 * default reverse-proxy port.
 */
const DEV_PORTS = [3000, 3001, 4567] as const;

/**
 * Build the default `allowedOrigins` list for the demo site.
 *
 * Always includes the server's own port (so the bundled widget
 * works against the local server) and a small set of common dev
 * ports. When `PUBLIC_APP_URL` is set, the deployment's public
 * origin is added so the demo site works behind a reverse proxy
 * or on a custom hostname without requiring the operator to
 * hand-edit the database.
 */
export function buildDemoAllowedOrigins(env: Env): string[] {
  const origins = [
    `http://localhost:${env.PORT}`,
    ...DEV_PORTS.map((p) => `http://localhost:${p}`),
  ];
  if (env.PUBLIC_APP_URL) {
    origins.push(env.PUBLIC_APP_URL);
  }
  return origins;
}

/**
 * The full default configuration for the seeded `demo` site. Knowledge
 * and FAQ entries are written in provider-neutral language so the
 * output scrubber does not have to strip them on every request.
 */
export function buildDemoSiteConfig(env: Env) {
  return {
    siteId: "demo",
    allowedOrigins: buildDemoAllowedOrigins(env),
    branding: {
      name: "Kody",
      tagline: "AI Assistant",
      colors: {
        primary: "#6D28D9",
        primaryForeground: "#FFFFFF",
        background: "#FFFFFF",
        foreground: "#1A1A2E",
        bubbleBackground: "#F3F0FF",
        userBubbleBackground: "#6D28D9",
        userBubbleForeground: "#FFFFFF",
      },
      position: "bottom-right",
      welcomeMessage:
        "Hi! I'm Kody, an open-source AI chat assistant. Ask me anything about adding AI to your website!",
      inputPlaceholder: "Ask me about Kody...",
      bubbleIcon: "chat",
      bubbleSize: "md",
      theme: "light",
      borderRadius: 12,
    },
    personality: {
      tone: "friendly",
      formality: "balanced",
      responseLength: "balanced",
    },
    ai: {
      baseUrl: "http://localhost:11434/v1",
      apiKey: "ollama",
      model: "llama3.2",
      temperature: 0.7,
      maxTokens: 1024,
    },
    guardrails: {
      allowedTopics: [
        "Kody",
        "chatbots",
        "AI assistants",
        "website integration",
        "self-hosting",
        "open source",
      ],
      topicDescription: "Kody — the open-source embeddable AI chat assistant",
      refusalMessage:
        "I can only help with questions about Kody and AI chat assistants for websites.",
      blockedInputPatterns: [],
      blockedOutputPatterns: [],
      maxInputLength: 2000,
      enablePromptInjectionDetection: true,
      enableOutputScrubbing: true,
    },
    knowledge: {
      sources: [
        {
          type: "text" as const,
          title: "About Kody",
          content: `Kody is an open-source (MIT license) embeddable AI chat assistant widget. Website owners add a single script tag and get a fully branded, topic-restricted AI assistant.

Key features: one-line embed, any compatible AI backend, full branding customization, three-layer guardrails, ticket creation (multiple issue-tracker and inbox providers), knowledge base support, Shadow DOM isolation, under 30 KB gzipped, self-hosted with SQLite, admin dashboard.`,
        },
        {
          type: "text" as const,
          title: "Getting Started",
          content: `Installation: Clone the public repository, run pnpm install, pnpm build, pnpm run dev. For production use Docker with docker-compose.prod.yml.

Embedding: Add a script tag pointing to your server's /widget.js with data-site-id, or use window.KodyConfig. Configure sites via the admin dashboard at /admin.`,
        },
        {
          type: "text" as const,
          title: "Configuration Reference",
          content: `Site config includes: siteId, allowedOrigins, branding (name, colors, position, welcomeMessage), ai (baseUrl, apiKey, model, temperature, maxTokens), guardrails (allowedTopics, refusalMessage, blockedPatterns), knowledge (text/faq/url/file sources), tickets (multiple provider types), rateLimit.`,
        },
        {
          type: "text" as const,
          title: "Security & Guardrails",
          content: `Three layers: 1) Input filter — blocks prompt injection, enforces length limits, detects Unicode homoglyphs. 2) System prompt — enforces topic restrictions, identity rules, never reveals config. 3) Output scrubber — removes provider or model names that surface in the response, detects system prompt leaks. API keys never sent to browser.`,
        },
        {
          type: "text" as const,
          title: "Self-Hosting Guide",
          content: `Deploy with Docker or bare metal. Requires Node.js 22+, pnpm 9+, and a compatible chat-completion API. Env vars: PORT (default 3456), DATABASE_PATH, ADMIN_EMAIL, ADMIN_PASSWORD, PUBLIC_APP_URL (optional, used by the demo site to allow the deployment's public origin). SQLite database with zero external dependencies. Use nginx as reverse proxy for production.`,
        },
        {
          type: "faq" as const,
          entries: [
            { question: "Is Kody free?", answer: "Yes. 100% open source under MIT license. Self-host at no cost." },
            { question: "What AI providers work?", answer: "Any compatible chat-completion API: the operator configures the base URL, API key, and model name in the admin dashboard." },
            { question: "Does it expose AI provider names?", answer: "No. The output scrubber removes all provider and model names automatically." },
            { question: "What's the tech stack?", answer: "TypeScript monorepo: Express 5 + SQLite server, vanilla TS Shadow DOM widget (Vite IIFE), Vite + React admin SPA." },
          ],
        },
      ],
      maxContextTokens: 4000,
    },
    tickets: {
      enabled: false,
      promptMessage: "",
      providers: [],
      requiredFields: ["name", "email", "description"],
    },
    rateLimit: { messagesPerMinute: 10, messagesPerHour: 60, messagesPerDay: 200 },
    compliance: {
      aiDisclosureEnabled: true,
      aiDisclosureMessage: "You are chatting with an AI assistant.",
      conversationDeletionEnabled: true,
    },
    conversationStarters: [
      "What is Kody?",
      "How do I embed the widget?",
      "What AI providers are supported?",
      "Is Kody free to use?",
    ],
    enabled: true,
  };
}

/**
 * Seed the demo site if it does not already exist. Idempotent — a
 * second call against a populated database is a no-op. Returns
 * `true` when a new site was created, `false` when one was
 * already present (or could not be created because the schema
 * rejected the config).
 *
 * When the demo site already exists, this also reconciles its
 * `allowedOrigins` against the current `PUBLIC_APP_URL` so that
 * an operator who later adds a public-origin env var (e.g.
 * behind a reverse proxy) gets a working demo origin without
 * having to hand-edit the database. Existing origins are never
 * removed — only the new `PUBLIC_APP_URL` origin is appended.
 *
 * `SiteStore.getSiteConfig` returns `null` for both "row absent" and
 * "row present but disabled" (the runtime path filters disabled
 * sites out so the chat pipeline never serves them). Without
 * disambiguating those, every server restart for an operator who
 * disabled the demo would fall through to `createSite`, hit a
 * UNIQUE constraint, and log a misleading "Failed to seed demo
 * site" error. Use `hasSiteRecord` to preserve the operator's
 * disabled state and only reconcile genuinely missing demo sites.
 */
export function seedDemoSite(siteStore: SiteStore, env: Env): boolean {
  const existing = siteStore.getSiteConfig("demo");
  if (existing) {
    if (
      env.PUBLIC_APP_URL &&
      !existing.allowedOrigins.includes(env.PUBLIC_APP_URL)
    ) {
      try {
        siteStore.updateSite("demo", {
          allowedOrigins: [...existing.allowedOrigins, env.PUBLIC_APP_URL],
        });
      } catch (error) {
        console.error("Failed to reconcile demo site allowedOrigins:", error);
      }
    }
    return false;
  }
  // getSiteConfig is null — either no demo row exists, or the row
  // exists but is disabled. Reconcile only the genuinely-missing
  // case; preserve a disabled record so operator intent survives
  // a restart.
  if (siteStore.hasSiteRecord("demo")) {
    return false;
  }
  try {
    siteStore.createSite(buildDemoSiteConfig(env));
    return true;
  } catch (error) {
    console.error("Failed to seed demo site:", error);
    return false;
  }
}
