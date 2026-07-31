import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { getDb } from "./db/index.js";
import { logStore } from "./services/log-store.js";
import { seedDemoSite } from "./seed-demo.js";

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
  console.log(
    `Demo site 'demo' created (allowed origins: http://localhost:${env.PORT}` +
      (env.PUBLIC_APP_URL ? `, ${env.PUBLIC_APP_URL}` : "") +
      ", and a few common dev ports)",
  );
}

app.listen(env.PORT, () => {
  console.log(`Kody server listening on port ${env.PORT} (${env.NODE_ENV})`);
});
