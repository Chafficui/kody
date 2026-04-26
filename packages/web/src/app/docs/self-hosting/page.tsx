export default function SelfHostingPage() {
  return (
    <article>
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Self-Hosting</h1>
      <p className="mb-10 text-lg text-muted-foreground">
        Run Kody on your own infrastructure with full control over your data. Choose between Docker
        Compose (recommended), bare Node.js with systemd, or any other deployment method.
      </p>

      {/* Requirements */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Requirements</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground">
          <li>
            <strong>Node.js 18+</strong> (22 LTS recommended) &mdash; only needed for bare metal
            deployment
          </li>
          <li>
            <strong>pnpm</strong> &mdash; install with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">corepack enable pnpm</code>
          </li>
          <li>
            <strong>Docker and Docker Compose</strong> &mdash; for containerized deployment
            (recommended)
          </li>
          <li>
            <strong>An OpenAI-compatible AI endpoint</strong> &mdash; Ollama, vLLM, llama.cpp,
            OpenAI, or any compatible provider
          </li>
          <li>
            <strong>~100 MB disk space</strong> for the application and SQLite database
          </li>
        </ul>
      </section>

      {/* Docker Compose */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Docker Compose (Recommended)</h2>
        <p className="mb-4 text-foreground">
          The easiest way to deploy Kody. The repository includes two Docker Compose files:
        </p>
        <ul className="mb-4 list-inside list-disc space-y-2 text-foreground">
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">docker-compose.yml</code>{" "}
            &mdash; development setup with Ollama, server, and web
          </li>
          <li>
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">docker-compose.prod.yml</code>{" "}
            &mdash; production setup with health checks, restart policies, and env file support
          </li>
        </ul>

        <h3 className="mb-3 text-lg font-semibold">Development</h3>
        <p className="mb-4 text-foreground">
          Starts an Ollama instance alongside the Kody server and web frontend:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`git clone https://github.com/chafficui/kody.git
cd kody
docker compose up -d`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          This starts three services: Ollama on port 11434, the Kody server on port 3456, and the
          web frontend on port 3000. The SQLite database is persisted in a Docker volume.
        </p>

        <h3 className="mb-3 mt-6 text-lg font-semibold">Production</h3>
        <p className="mb-4 text-foreground">
          Create a <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.env</code> file in the
          project root:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=a-strong-password
NODE_ENV=production
PORT=3456
LOG_LEVEL=info`}</code>
        </pre>
        <p className="my-4 text-foreground">Then start with the production compose file:</p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`docker compose -f docker-compose.prod.yml up -d`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          The production compose file includes automatic restarts (
          <code className="text-xs">restart: always</code>), health checks (hitting{" "}
          <code className="text-xs">/health</code> every 30s), and persists the SQLite database in a
          Docker volume at <code className="text-xs">/data/kody.db</code>.
        </p>
      </section>

      {/* Docker architecture */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Docker Images</h2>
        <p className="mb-4 text-foreground">
          Kody uses multi-stage Docker builds for minimal image sizes:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Image</th>
                <th className="pb-2 pr-4 font-semibold">Dockerfile</th>
                <th className="pb-2 pr-4 font-semibold">Base</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">kody-server</td>
                <td className="py-2 pr-4 font-mono text-xs">Dockerfile.server</td>
                <td className="py-2 pr-4">node:22-alpine</td>
                <td className="py-2">
                  API server + widget bundle. Builds shared, widget, and server packages. Production
                  stage installs only production dependencies. Runs as non-root{" "}
                  <code className="text-xs">node</code> user.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">kody-web</td>
                <td className="py-2 pr-4 font-mono text-xs">Dockerfile.web</td>
                <td className="py-2 pr-4">node:22-alpine</td>
                <td className="py-2">
                  Next.js standalone output for the marketing/docs/admin site. Runs as non-root{" "}
                  <code className="text-xs">node</code> user.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Environment Variables */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Environment Variables</h2>
        <p className="mb-4 text-foreground">
          All environment variables are validated with Zod on server startup. Invalid values cause
          the server to exit with a descriptive error.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Variable</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">PORT</td>
                <td className="py-2 pr-4">3456</td>
                <td className="py-2">
                  Port the server listens on. Range: 1-65535. Automatically coerced from string.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">NODE_ENV</td>
                <td className="py-2 pr-4">development</td>
                <td className="py-2">
                  Must be <code className="text-xs">development</code>,{" "}
                  <code className="text-xs">production</code>, or{" "}
                  <code className="text-xs">test</code>. Set to{" "}
                  <code className="text-xs">production</code> for deployments.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">DATABASE_PATH</td>
                <td className="py-2 pr-4">./kody.db</td>
                <td className="py-2">
                  Path to the SQLite database file. In Docker, this defaults to{" "}
                  <code className="text-xs">/data/kody.db</code> (inside the volume).
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">ADMIN_EMAIL</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Email for the initial admin account. Must be a valid email address. Required for
                  first start to bootstrap the admin user.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">ADMIN_PASSWORD</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Password for the initial admin account. Minimum 8 characters. Hashed with argon2
                  before storage. Required for first start.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">CORS_ALLOW_ALL_DEV</td>
                <td className="py-2 pr-4">false</td>
                <td className="py-2">
                  Skip origin checks in development. Automatically coerced from string.{" "}
                  <strong>Never enable in production.</strong>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">LOG_LEVEL</td>
                <td className="py-2 pr-4">info</td>
                <td className="py-2">
                  Logging verbosity: <code className="text-xs">debug</code>,{" "}
                  <code className="text-xs">info</code>, <code className="text-xs">warn</code>, or{" "}
                  <code className="text-xs">error</code>.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Bare metal */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Bare Metal Deployment</h2>
        <p className="mb-4 text-foreground">
          If you prefer not to use Docker, you can run Kody directly with Node.js:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`git clone https://github.com/chafficui/kody.git
cd kody
pnpm install
pnpm build

export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="a-strong-password"
export NODE_ENV="production"
export PORT=3456

cd packages/server
node dist/index.js`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          The server creates the SQLite database and runs migrations automatically on first start.
          The widget bundle is served from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/widget.js</code> by the server
          &mdash; no separate static file hosting is needed.
        </p>
      </section>

      {/* Reverse Proxy */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Reverse Proxy (nginx)</h2>
        <p className="mb-4 text-foreground">
          In production you should put Kody behind a reverse proxy that handles TLS termination.
          Here is an example nginx configuration:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`server {
    listen 443 ssl http2;
    server_name kody.example.com;

    ssl_certificate     /etc/ssl/certs/kody.example.com.pem;
    ssl_certificate_key /etc/ssl/private/kody.example.com.key;

    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support for streaming responses
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    server_name kody.example.com;
    return 301 https://$host$request_uri;
}`}</code>
        </pre>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Important:</strong> Disable proxy buffering (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">proxy_buffering off</code>) so
          that SSE streaming chat responses are delivered to the client in real time. Without this,
          nginx will buffer the entire response before sending it, making the chat appear to hang
          until the AI finishes generating.
        </div>
      </section>

      {/* Database */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Database</h2>
        <p className="mb-4 text-foreground">
          Kody uses SQLite via better-sqlite3 &mdash; no external database server required. The
          database file is created at the path specified by the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">DATABASE_PATH</code> environment
          variable (defaults to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">./kody.db</code> in bare metal,
          or <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/data/kody.db</code> in
          Docker).
        </p>
        <p className="mb-4 text-foreground">
          The database stores site configurations, admin users (with argon2-hashed passwords),
          session tokens, conversation history, and cached knowledge content. Migrations in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            packages/server/src/db/migrations/
          </code>{" "}
          are applied automatically when the server starts.
        </p>

        <h3 className="mb-3 text-lg font-semibold">Backups</h3>
        <p className="mb-4 text-foreground">
          Since SQLite stores everything in a single file, backups are straightforward:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`# Option 1: sqlite3 backup (safe while server is running)
sqlite3 kody.db ".backup kody-backup.db"

# Option 2: file copy (stop the server first)
cp kody.db kody-backup-$(date +%Y%m%d).db

# Option 3: Docker volume backup
docker compose exec server sqlite3 /data/kody.db ".backup /data/kody-backup.db"
docker cp $(docker compose ps -q server):/data/kody-backup.db ./kody-backup.db`}</code>
        </pre>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> Use the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">sqlite3 .backup</code> command
          for live backups &mdash; it creates a consistent snapshot even while the server is
          handling requests. File copies while the server is running may produce a corrupted backup.
        </div>
      </section>

      {/* Process Management */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Process Management (systemd)</h2>
        <p className="mb-4 text-foreground">
          For bare metal deployments without Docker, use systemd to keep Kody running and
          automatically restart on crashes:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`[Unit]
Description=Kody AI Chat Assistant
After=network.target

[Service]
Type=simple
User=kody
WorkingDirectory=/opt/kody/packages/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3456
Environment=DATABASE_PATH=/opt/kody/data/kody.db
Environment=ADMIN_EMAIL=admin@example.com
Environment=ADMIN_PASSWORD=change-me-on-first-run
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target`}</code>
        </pre>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`# Install the service
sudo cp kody.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kody
sudo systemctl start kody

# View logs
sudo journalctl -u kody -f`}</code>
        </pre>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Security tip:</strong> Create a dedicated{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">kody</code> system user with no
          login shell and minimal permissions. The server only needs read access to its own
          directory and read/write access to the database path.
        </div>
      </section>

      {/* Health check */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Health Check</h2>
        <p className="mb-4 text-foreground">
          The server exposes a{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/health</code> endpoint that
          returns a 200 status when the server is healthy. Use this for load balancer health checks,
          Docker health checks, and monitoring:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`curl http://localhost:3456/health`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          The production Docker Compose file includes a health check that hits this endpoint every
          30 seconds with a 5-second timeout and 3 retries.
        </p>
      </section>

      {/* Updating */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Updating</h2>
        <p className="mb-4 text-foreground">To update to a new version of Kody:</p>

        <h3 className="mb-3 text-lg font-semibold">Docker</h3>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`cd kody
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d`}</code>
        </pre>

        <h3 className="mb-3 mt-6 text-lg font-semibold">Bare metal</h3>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`cd /opt/kody
git pull
pnpm install
pnpm build
sudo systemctl restart kody`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          Database migrations are applied automatically on server start &mdash; no manual migration
          step is needed. Always back up the database before updating, just in case.
        </p>
      </section>
    </article>
  );
}
