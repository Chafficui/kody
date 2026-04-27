import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import helmet from "helmet";
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
import { createSiteAuth } from "./middleware/site-auth.js";
import { createAdminAuth } from "./middleware/admin-auth.js";
import { createRateLimitMiddleware, RateLimiter } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { SiteStore } from "./services/site-store.js";
import { ConversationStore } from "./services/conversation-store.js";
import { AdminAuthService } from "./services/admin/auth-service.js";
import { UserAuthService } from "./services/user/auth-service.js";
import { createUserAuth } from "./middleware/user-auth.js";
import { createUserAuthRouter } from "./routes/user/auth.js";
import { createUserSitesRouter } from "./routes/user/sites.js";

export interface AppDependencies {
  db: Database.Database;
  rateLimiter?: RateLimiter;
  conversationStore?: ConversationStore;
}

export function createApp(
  deps: AppDependencies,
): Express & { siteStore: SiteStore; authService: AdminAuthService; userAuthService: UserAuthService } {
  const app = express();
  const siteStore = new SiteStore(deps.db);
  const authService = new AdminAuthService(deps.db);
  const userAuthService = new UserAuthService(deps.db);
  const rateLimiter = deps.rateLimiter ?? new RateLimiter();
  const conversationStore = deps.conversationStore ?? new ConversationStore();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: false,
    }),
  );
  app.use(express.json({ limit: "16kb" }));

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
  app.use("/api/chat", siteAuth, rateLimit, createChatRouter(conversationStore));
  app.use("/api/tickets", siteAuth, rateLimit, createTicketsRouter(conversationStore));

  app.use("/api/admin", createAdminAuthRouter(authService));

  const adminAuth = createAdminAuth(authService);
  app.use("/api/admin/sites", adminAuth, createAdminSitesRouter(siteStore));
  app.use("/api/admin/users", adminAuth, createAdminUsersRouter(authService));
  app.use("/api/admin/logs", adminAuth, createAdminLogsRouter());

  app.use("/api/auth", createUserAuthRouter(userAuthService));

  const userAuth = createUserAuth(userAuthService);
  app.use("/api/user/sites", userAuth, createUserSitesRouter(siteStore));

  // Serve admin SPA static files
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const adminDist = path.resolve(__dirname, "../../admin/dist");
  app.use("/admin", express.static(adminDist));
  app.use("/admin/{*splat}", (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });

  app.use(errorHandler);

  const result = app as Express & {
    siteStore: SiteStore;
    authService: AdminAuthService;
    userAuthService: UserAuthService;
  };
  result.siteStore = siteStore;
  result.authService = authService;
  result.userAuthService = userAuthService;

  return result;
}
