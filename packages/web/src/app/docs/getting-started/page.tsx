export default function GettingStartedPage() {
  return (
    <article>
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Getting Started</h1>
      <p className="mb-10 text-lg text-muted-foreground">
        Go from zero to a working AI chat widget in five minutes.
      </p>

      {/* Prerequisites */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Prerequisites</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground">
          <li>
            <strong>Node.js 18+</strong> (22 LTS recommended) &mdash; check with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">node -v</code>
          </li>
          <li>
            <strong>pnpm</strong> &mdash; install with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">corepack enable pnpm</code>
          </li>
          <li>
            <strong>An OpenAI-compatible AI endpoint</strong> &mdash; any provider that implements
            the OpenAI chat completions API. We recommend{" "}
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Ollama
            </a>{" "}
            for local development, but you can also use{" "}
            <a
              href="https://github.com/vllm-project/vllm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              vLLM
            </a>
            , llama.cpp, OpenAI, or any compatible provider
          </li>
          <li>
            <strong>Docker</strong> (optional) &mdash; for containerized deployment. See{" "}
            <a
              href="/docs/self-hosting"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Self-Hosting
            </a>
          </li>
        </ul>
      </section>

      {/* Installation */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">1. Clone and Install</h2>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`git clone https://github.com/chafficui/kody.git
cd kody
pnpm install
pnpm build`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          This builds all four packages in dependency order:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">@kody/shared</code> {"->"}{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">@kody/widget</code> {"->"}{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">@kody/server</code> {"->"}{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">@kody/web</code>.
        </p>
      </section>

      {/* Configuration */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">2. Configure the Server</h2>
        <p className="mb-4 text-foreground">
          Set the admin credentials via environment variables before starting the server. These
          bootstrap the initial admin account (passwords are hashed with argon2):
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="a-strong-password"

cd packages/server
pnpm start`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          The server starts on port <strong>3456</strong> by default. Set the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">PORT</code> environment variable
          to change it. The SQLite database is created automatically on first start with all
          migrations applied.
        </p>
      </section>

      {/* Create first site - Admin UI */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">3. Create Your First Site</h2>
        <p className="mb-4 text-foreground">
          You can create sites through the admin dashboard or the API.
        </p>

        <h3 className="mb-3 text-lg font-semibold">Option A: Admin Dashboard</h3>
        <p className="mb-4 text-foreground">
          Navigate to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            http://localhost:3000/admin
          </code>{" "}
          (or{" "}
          <a
            href="https://kody.codai.app/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            kody.codai.app/admin
          </a>{" "}
          for the hosted version) and log in with your admin credentials. From there you can create
          and manage sites with a visual interface.
        </p>

        <h3 className="mb-3 text-lg font-semibold">Option B: Admin API</h3>
        <p className="mb-4 text-foreground">First, obtain a session cookie:</p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`curl -X POST http://localhost:3456/api/admin/auth/login \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{
    "email": "admin@example.com",
    "password": "a-strong-password"
  }'`}</code>
        </pre>
        <p className="my-4 text-foreground">Then create the site:</p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`curl -X POST http://localhost:3456/api/admin/sites \\
  -H "Content-Type: application/json" \\
  -b cookies.txt \\
  -d '{
    "siteId": "my-site",
    "allowedOrigins": ["http://localhost:3000"],
    "ai": {
      "baseUrl": "http://localhost:11434/v1",
      "apiKey": "ollama",
      "model": "llama3"
    },
    "guardrails": {
      "allowedTopics": ["general"],
      "topicDescription": "General questions about our product"
    }
  }'`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          The minimum required fields are{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">siteId</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">allowedOrigins</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ai</code> (with baseUrl and
          model), and <code className="rounded bg-muted px-1.5 py-0.5 text-xs">guardrails</code>{" "}
          (with allowedTopics and topicDescription). Everything else has sensible defaults. See the{" "}
          <a
            href="/docs/configuration"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Configuration
          </a>{" "}
          page for the full schema.
        </p>
      </section>

      {/* Embed the widget */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">4. Embed the Widget</h2>
        <p className="mb-4 text-foreground">
          Add a single script tag to any HTML page. The widget renders inside a Shadow DOM, fully
          isolated from your page styles. At ~8 KB gzipped, it adds negligible overhead.
        </p>

        <h3 className="mb-3 text-lg font-semibold">Script tag (simplest)</h3>
        <p className="mb-4 text-foreground">
          Replace <code className="rounded bg-muted px-1.5 py-0.5 text-sm">your-site-id</code> with
          the <code className="rounded bg-muted px-1.5 py-0.5 text-sm">siteId</code> you chose
          above:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`<!-- For the hosted version -->
<script
  src="https://kody.codai.app/widget.js"
  data-site-id="my-site"
  async
></script>

<!-- For local development -->
<script
  src="http://localhost:3456/widget.js"
  data-site-id="my-site"
  async
></script>`}</code>
        </pre>

        <h3 className="mb-3 mt-6 text-lg font-semibold">
          window.KodyConfig (client-side overrides)
        </h3>
        <p className="mb-4 text-foreground">
          For more control, set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">window.KodyConfig</code> before
          the script loads. Client-side config overrides branding values for the current page:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`<script>
  window.KodyConfig = {
    siteId: "my-site",
    position: "bottom-left",
    name: "Support Bot",
    primaryColor: "#10b981"
  };
</script>
<script src="https://kody.codai.app/widget.js" async></script>`}</code>
        </pre>
      </section>

      {/* Test */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">5. Test It</h2>
        <p className="mb-4 text-foreground">
          Open the page where you added the script tag. You should see a chat bubble in the
          bottom-right corner (or wherever you configured it). Click it to open the widget and send
          a message.
        </p>
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> If using Ollama, make sure it is running
          (<code className="rounded bg-muted px-1.5 py-0.5 text-sm">ollama serve</code>) and the
          model is pulled (
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">ollama pull llama3</code>) before
          sending messages.
        </div>
      </section>

      {/* Widget features */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Widget Features</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground">
          <li>
            <strong>Shadow DOM isolation</strong> &mdash; widget styles never leak to or from your
            page
          </li>
          <li>
            <strong>Markdown rendering</strong> &mdash; bold, italic, inline code, code blocks,
            links, and lists in assistant responses
          </li>
          <li>
            <strong>Auto-linking</strong> &mdash; bare URLs in responses are automatically converted
            to clickable links
          </li>
          <li>
            <strong>SSE streaming</strong> &mdash; responses stream in real-time via Server-Sent
            Events
          </li>
          <li>
            <strong>Attention-seeking animations</strong> &mdash; configurable wiggle and tooltip
            animations that auto-dismiss when the user clicks the bubble
          </li>
          <li>
            <strong>Auto-growing textarea</strong> &mdash; the input field expands vertically as the
            user types longer messages
          </li>
          <li>
            <strong>Output scrubbing</strong> &mdash; AI provider names (ChatGPT, Claude, etc.) are
            automatically replaced with your configured assistant name
          </li>
          <li>
            <strong>Ticket creation</strong> &mdash; users can create support tickets directly from
            the chat when enabled
          </li>
        </ul>
      </section>

      {/* Next steps */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Next Steps</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground">
          <li>
            <a
              href="/docs/configuration"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Configuration
            </a>{" "}
            &mdash; customize branding, colors, AI settings, and guardrails
          </li>
          <li>
            <a
              href="/docs/knowledge-sources"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Knowledge Sources
            </a>{" "}
            &mdash; give your assistant context about your product
          </li>
          <li>
            <a
              href="/docs/ticket-providers"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Ticket Providers
            </a>{" "}
            &mdash; connect Jira, GitHub, Linear, or a webhook
          </li>
          <li>
            <a
              href="/docs/self-hosting"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Self-Hosting
            </a>{" "}
            &mdash; deploy to production with Docker or systemd
          </li>
          <li>
            <a
              href="/demo"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Interactive Demo
            </a>{" "}
            &mdash; try the widget configurator and copy the embed code
          </li>
        </ul>
      </section>
    </article>
  );
}
