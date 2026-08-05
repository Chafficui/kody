import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { getDb } from "./db/index.js";
import { logStore } from "./services/log-store.js";
import { buildDemoSiteConfig, seedDemoSite } from "./seed-demo.js";

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

if (seedDemoSite(app.siteStore, env)) {
  // Derive the log from the same allowedOrigins the seeder writes, so
  // the message stays in sync with buildDemoAllowedOrigins and DEV_PORTS.
  const origins = buildDemoSiteConfig(env).allowedOrigins;
  console.log(`Demo site 'demo' created (allowed origins: ${origins.join(", ")})`);
}

app.listen(env.PORT, () => {
  console.log(`Kody server listening on port ${env.PORT} (${env.NODE_ENV})`);
});
