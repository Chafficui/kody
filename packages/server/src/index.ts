import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { getDb } from "./db/index.js";

const env = loadEnv();
const db = getDb(env.DATABASE_PATH);
const app = createApp({ db });

if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
  app.authService.ensureAdminExists(env.ADMIN_EMAIL, env.ADMIN_PASSWORD).then((created) => {
    if (created) {
      console.log(`Admin user created: ${env.ADMIN_EMAIL}`);
    }
  });
}

const existing = app.siteStore.getSiteConfig("kody-website");
if (!existing) {
  try {
    app.siteStore.createSite({
      siteId: "kody-website",
      allowedOrigins: ["http://localhost:3000", "http://localhost:3001", "https://kody.codai.app"],
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
            url: "https://kody.codai.app",
            content: `Kody is an open-source (MIT license) embeddable AI chat assistant widget. Website owners add a single script tag and get a fully branded, topic-restricted AI assistant. Built by Felix Beinßen.

Key features: one-line embed, any OpenAI-compatible AI backend (Ollama, vLLM, llama.cpp, OpenAI), full branding customization, three-layer guardrails, ticket creation (Jira, GitHub, Linear, email, webhook), knowledge base support, Shadow DOM isolation, under 30 KB gzipped, self-hosted with SQLite, admin dashboard.`,
          },
          {
            type: "text" as const,
            title: "Getting Started",
            url: "https://kody.codai.app/docs/getting-started",
            content: `Installation: Clone github.com/chafficui/kody, run pnpm install, pnpm build, pnpm run dev. For production use Docker with docker-compose.prod.yml.

Embedding: Add a script tag pointing to your server's /widget.js with data-site-id, or use window.KodyConfig. Configure sites via the admin dashboard at /admin.`,
          },
          {
            type: "text" as const,
            title: "Configuration Reference",
            url: "https://kody.codai.app/docs/configuration",
            content: `Site config includes: siteId, allowedOrigins, branding (name, colors, position, welcomeMessage), ai (baseUrl, apiKey, model, temperature, maxTokens), guardrails (allowedTopics, refusalMessage, blockedPatterns), knowledge (text/faq/url/file sources), tickets (Jira/GitHub/Linear/email/webhook providers), rateLimit.`,
          },
          {
            type: "text" as const,
            title: "Security & Guardrails",
            url: "https://kody.codai.app/docs/security",
            content: `Three layers: 1) Input filter — blocks prompt injection, enforces length limits, detects Unicode homoglyphs. 2) System prompt — enforces topic restrictions, identity rules, never reveals config. 3) Output scrubber — removes AI provider names (Claude, OpenAI, GPT, Llama, etc.), detects system prompt leaks. API keys never sent to browser.`,
          },
          {
            type: "text" as const,
            title: "Self-Hosting Guide",
            url: "https://kody.codai.app/docs/self-hosting",
            content: `Deploy with Docker or bare metal. Requires Node.js 22+, pnpm 9+, and an OpenAI-compatible AI endpoint. Env vars: PORT (default 3456), DATABASE_PATH, ADMIN_EMAIL, ADMIN_PASSWORD. SQLite database with zero external dependencies. Use nginx as reverse proxy for production.`,
          },
          {
            type: "faq" as const,
            url: "https://kody.codai.app/docs",
            entries: [
              { question: "Is Kody free?", answer: "Yes. 100% open source under MIT license. Self-host at no cost." },
              { question: "What AI providers work?", answer: "Any OpenAI-compatible API: OpenAI, Ollama, vLLM, llama.cpp, and more." },
              { question: "Does it expose AI provider names?", answer: "No. The output scrubber removes all AI provider/model names automatically." },
              { question: "What's the tech stack?", answer: "TypeScript monorepo: Express 5 + SQLite server, vanilla TS Shadow DOM widget (Vite IIFE), Next.js + Tailwind CSS 4 web/admin." },
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
      enabled: true,
    });
    console.log("Demo site 'kody-website' created");
  } catch {
    // already exists or invalid — skip
  }
}

app.listen(env.PORT, () => {
  console.log(`Kody server listening on port ${env.PORT} (${env.NODE_ENV})`);
});
