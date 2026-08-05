import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { getDb } from "./db/index.js";
import { logStore } from "./services/log-store.js";

logStore.install();

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

// Boot sweep + slow interval to keep the `tool_jobs` table from
// growing without bound. Terminal jobs (succeeded / failed /
// timeout) older than 7 days are dropped; pending / running rows
// are left alone so we don't lose track of a long-running tool.
const TOOL_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TOOL_JOB_PRUNE_INTERVAL_MS = 60 * 60 * 1000; // every hour
{
  const { ToolJobStore } = await import("./services/tool-job-store.js");
  const jobStore = new ToolJobStore(db);
  const prunedAtBoot = jobStore.pruneTerminal(TOOL_JOB_RETENTION_MS);
  if (prunedAtBoot > 0) {
    console.log(`[tool-jobs] pruned ${prunedAtBoot} terminal job(s) older than 7d at boot`);
  }
  const interval = setInterval(() => {
    try {
      const pruned = jobStore.pruneTerminal(TOOL_JOB_RETENTION_MS);
      if (pruned > 0) {
        console.log(`[tool-jobs] pruned ${pruned} terminal job(s) older than 7d`);
      }
    } catch (err) {
      console.error("[tool-jobs] retention sweep failed:", err);
    }
  }, TOOL_JOB_PRUNE_INTERVAL_MS);
  // Don't keep the process alive solely for this sweep.
  interval.unref?.();
}

const existing = app.siteStore.getSiteConfig("demo");
if (!existing) {
  try {
    // Build the allowed-origin list. Self-hosters set PUBLIC_ORIGIN
    // to their public URL; the localhost ports are always added so
    // the bundled demo page at GET / works out of the box. The env
    // schema already validates each comma-separated entry as a
    // valid http(s) origin and dedupes them, so we can use the
    // list directly.
    const publicOrigins = env.PUBLIC_ORIGIN ?? [];
    app.siteStore.createSite({
      siteId: "demo",
      allowedOrigins: [
        ...publicOrigins,
        `http://localhost:${env.PORT}`,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:4567",
      ],
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

Key features: one-line embed, any OpenAI-compatible AI backend (Ollama, vLLM, llama.cpp, OpenAI), full branding customization, three-layer guardrails, ticket creation (Jira, GitHub, Linear, email, webhook), knowledge base support, Shadow DOM isolation, under 30 KB gzipped, self-hosted with SQLite, admin dashboard.`,
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
            content: `Site config includes: siteId, allowedOrigins, branding (name, colors, position, welcomeMessage), ai (baseUrl, apiKey, model, temperature, maxTokens), guardrails (allowedTopics, refusalMessage, blockedPatterns), knowledge (text/faq/url/file sources), tickets (Jira/GitHub/Linear/email/webhook providers), rateLimit.`,
          },
          {
            type: "text" as const,
            title: "Security & Guardrails",
            content: `Three layers: 1) Input filter — blocks prompt injection, enforces length limits, detects Unicode homoglyphs. 2) System prompt — enforces topic restrictions, identity rules, never reveals config. 3) Output scrubber — removes AI provider names (Claude, OpenAI, GPT, Llama, etc.), detects system prompt leaks. API keys never sent to browser.`,
          },
          {
            type: "text" as const,
            title: "Self-Hosting Guide",
            content: `Deploy with Docker or bare metal. Requires Node.js 22+, pnpm 9+, and an OpenAI-compatible AI endpoint. Env vars: PORT (default 3456), DATABASE_PATH, ADMIN_EMAIL, ADMIN_PASSWORD. SQLite database with zero external dependencies. Use nginx as reverse proxy for production.`,
          },
          {
            type: "faq" as const,
            entries: [
              { question: "Is Kody free?", answer: "Yes. 100% open source under MIT license. Self-host at no cost." },
              { question: "What AI providers work?", answer: "Any OpenAI-compatible API: OpenAI, Ollama, vLLM, llama.cpp, and more." },
              { question: "Does it expose AI provider names?", answer: "No. The output scrubber removes all AI provider/model names automatically." },
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
    });
    const port = `http://localhost:${env.PORT}`;
    const origins = [port, "http://localhost:3000", "http://localhost:3001", "http://localhost:4567"]
      .concat(publicOrigins)
      .join(", ");
    console.log(`Demo site 'demo' created (allowed origins: ${origins})`);
  } catch {
    // already exists or invalid — skip
  }
} else {
  // Demo site already exists. This is the idempotent re-seed
  // path: we never overwrite operator changes (e.g. an admin who
  // edited the demo site's branding through /admin). A future
  // migration can re-introduce seeding once we have a "seed
  // version" notion.
  console.log("Demo site 'demo' already exists; leaving operator config untouched");
}

app.listen(env.PORT, () => {
  console.log(`Kody server listening on port ${env.PORT} (${env.NODE_ENV})`);
});
