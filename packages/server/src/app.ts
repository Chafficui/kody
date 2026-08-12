import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import express, { type Express } from "express";
import helmet from "helmet";
import yaml from "js-yaml";
import type Database from "better-sqlite3";
import { healthRouter } from "./routes/health.js";
import { createConfigRouter } from "./routes/config.js";
import { createChatRouter } from "./routes/chat.js";
import { createTicketsRouter } from "./routes/tickets.js";
import { createAdminAuthRouter } from "./routes/admin/auth.js";
import { createAdminSitesRouter } from "./routes/admin/sites.js";
import { createAdminUsersRouter } from "./routes/admin/users.js";
import { createAdminLogsRouter } from "./routes/admin/logs.js";
import { createWidgetRouter } from "./routes/widget.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createFeedbackRouter } from "./routes/feedback.js";
import { createSiteAuth } from "./middleware/site-auth.js";
import { createAdminAuth } from "./middleware/admin-auth.js";
import { createRateLimitMiddleware, RateLimiter } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { SiteStore } from "./services/site-store.js";
import { ConversationStore } from "./services/conversation-store.js";
import { AdminAuthService } from "./services/admin/auth-service.js";
import { UrlFetcher } from "./services/knowledge/url-fetcher.js";
import { ScrapeStore } from "./services/scrape-store.js";
import { createAdminScrapingRouter } from "./routes/admin/scraping.js";

export interface AppDependencies {
  db: Database.Database;
  rateLimiter?: RateLimiter;
  conversationStore?: ConversationStore;
}

export function createApp(
  deps: AppDependencies,
): Express & { siteStore: SiteStore; authService: AdminAuthService } {
  const app = express();
  const siteStore = new SiteStore(deps.db);
  const authService = new AdminAuthService(deps.db);
  const rateLimiter = deps.rateLimiter ?? new RateLimiter();
  const conversationStore = deps.conversationStore ?? new ConversationStore();
  const urlFetcher = new UrlFetcher();
  const scrapeStore = new ScrapeStore(deps.db, urlFetcher, siteStore);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: false,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-kody-site-id, Authorization");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use("/health", healthRouter);
  app.use("/widget.js", createWidgetRouter());
  app.use("/api/config", createConfigRouter(siteStore));

  const siteAuth = createSiteAuth(siteStore);
  const rateLimit = createRateLimitMiddleware(rateLimiter);
  app.use("/api/chat", siteAuth, rateLimit, createChatRouter(conversationStore, urlFetcher, deps.db));
  app.use("/api/tickets", siteAuth, rateLimit, createTicketsRouter(conversationStore));
  app.use("/api/sessions", siteAuth, createSessionsRouter(conversationStore));
  app.use("/api/feedback", siteAuth, createFeedbackRouter(deps.db));

  app.use("/api/admin", createAdminAuthRouter(authService));

  const adminAuth = createAdminAuth(authService);
  app.use("/api/admin/sites", adminAuth, createAdminSitesRouter(siteStore));
  app.use("/api/admin/sites", adminAuth, createAdminScrapingRouter(scrapeStore));
  app.use("/api/admin/users", adminAuth, createAdminUsersRouter(authService));
  app.use("/api/admin/logs", adminAuth, createAdminLogsRouter());

  // Demo page
  app.get("/", (_req, res) => {
    res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kody Demo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; background: #fafafa; }
    .hero { max-width: 720px; margin: 0 auto; padding: 80px 24px; }
    h1 { font-size: 2.5rem; margin-bottom: 12px; }
    h1 span { color: #6D28D9; }
    p { font-size: 1.1rem; color: #555; line-height: 1.6; margin-bottom: 16px; }
    .badge { display: inline-block; background: #f3f0ff; color: #6D28D9; padding: 4px 12px; border-radius: 999px; font-size: 0.85rem; font-weight: 500; margin-bottom: 24px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 32px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card h3 { font-size: 1rem; margin-bottom: 6px; }
    .card p { font-size: 0.9rem; margin: 0; }
    a { color: #6D28D9; }
  </style>
</head>
<body>
  <div class="hero">
    <div class="badge">Demo Page</div>
    <h1>Welcome to <span>Kody</span></h1>
    <p>This is a demo page with the Kody chat widget embedded. Click the chat bubble in the bottom-right corner to start a conversation.</p>
    <p>Admin dashboard: <a href="/admin/">/admin</a></p>
    <div class="cards">
      <div class="card">
        <h3>AI Disclosure</h3>
        <p>EU AI Act Article 50 compliant — users are informed they're chatting with AI.</p>
      </div>
      <div class="card">
        <h3>Conversation Starters</h3>
        <p>Quick-reply buttons to guide users into common topics.</p>
      </div>
      <div class="card">
        <h3>Feedback</h3>
        <p>Thumbs up/down on every assistant message for quality tracking.</p>
      </div>
      <div class="card">
        <h3>Data Deletion</h3>
        <p>GDPR right to erasure — users can delete their conversation.</p>
      </div>
    </div>
  </div>
  <script src="/widget.js" data-site-id="demo"></script>
</body>
</html>`);
  });

  // Serve admin SPA static files
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const adminDist = path.resolve(__dirname, "../../admin/dist");
  app.use("/admin", express.static(adminDist));
  app.use("/admin/{*splat}", (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });

  // OpenAPI spec (generated by `pnpm --filter @kody/shared generate:openapi`).
  // The file is committed to the repo at packages/shared/openapi.yaml and
  // shipped in the Docker image so /openapi.yaml and /openapi.json are always
  // available next to the running API.
  const openapiPath = path.resolve(__dirname, "../../shared/openapi.yaml");
  // Load the YAML eagerly and cache it. The file is small (~60KB) and
  // reading it once at boot is cheaper than re-reading on every request.
  // A missing file is a deploy problem, not a runtime problem.
  //
  // Parse-then-assign: read the YAML into a local first, then assign
  // the caches only after `yaml.load` succeeds. If either step throws
  // (e.g. a truncated YAML file) the caches stay null and the routes
  // fall back to the 503 path. The previous code could leave a half-
  // initialized cache (`openapiYamlCache` set, `openapiJsonCache`
  // null) which would let /openapi.yaml serve stale bytes while
  // /openapi.json returned 503 — a confusing combination.
  let openapiYamlCache: string | null = null;
  let openapiJsonCache: unknown = null;
  try {
    const yamlText = readFileSync(openapiPath, "utf8");
    const parsed = yaml.load(yamlText);
    openapiYamlCache = yamlText;
    openapiJsonCache = parsed;
  } catch (err) {
    console.warn(
      `[openapi] failed to load ${openapiPath}: ${(err as Error).message}. ` +
        "Run `pnpm --filter @kody/shared generate:openapi` to (re)generate it.",
    );
  }
  // Long-lived browser cache for the spec — it only changes on rebuild,
  // so SDK generators and the admin UI can fetch it once per session.
  const OPENAPI_CACHE_CONTROL = "public, max-age=300, must-revalidate";
  // ETags are content-based (SHA-256 of the body) so conditional GETs
  // (If-None-Match) can short-circuit unchanged payloads. We compute
  // them once at boot because the spec is loaded from disk then frozen
  // — re-hashing on every request would defeat the point.
  const etagFor = (body: string): string => {
    const digest = createHash("sha256").update(body).digest("base64url");
    return `"${digest}"`;
  };
  let openapiJsonBody = "";
  let openapiJsonEtag = "";
  if (openapiJsonCache !== null) {
    openapiJsonBody = JSON.stringify(openapiJsonCache);
    openapiJsonEtag = etagFor(openapiJsonBody);
  }
  const openapiYamlEtag = openapiYamlCache ? etagFor(openapiYamlCache) : "";
  app.get("/openapi.yaml", (_req, res) => {
    if (!openapiYamlCache) {
      res.status(503).type("text/plain").send("OpenAPI spec not available");
      return;
    }
    res
      .type("application/yaml")
      .set("Cache-Control", OPENAPI_CACHE_CONTROL)
      .set("ETag", openapiYamlEtag)
      .send(openapiYamlCache);
  });
  app.get("/openapi.json", (_req, res) => {
    if (!openapiJsonCache) {
      res.status(503).type("text/plain").send("OpenAPI spec not available");
      return;
    }
    res
      .type("application/json")
      .set("Cache-Control", OPENAPI_CACHE_CONTROL)
      .set("ETag", openapiJsonEtag)
      .send(openapiJsonBody);
  });

  app.use(errorHandler);

  const result = app as Express & {
    siteStore: SiteStore;
    authService: AdminAuthService;
  };
  result.siteStore = siteStore;
  result.authService = authService;

  return result;
}
