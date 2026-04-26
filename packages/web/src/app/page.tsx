const EMBED_SNIPPET = `<script src="https://kody.codai.app/widget.js" data-site-id="your-site" async></script>`;

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-2xl text-primary">
      {children}
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <circle cx="6" cy="6" r="1" fill="currentColor" />
        <circle cx="6" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
    title: "Any AI Backend",
    description:
      "Use any OpenAI-compatible endpoint: Ollama, vLLM, llama.cpp. Your AI, your infrastructure.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Topic Guardrails",
    description:
      "Define exactly what your assistant can help with. Three-layer protection ensures it stays on topic.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Full Branding",
    description:
      "Custom name, colors, logo, welcome message. No 'Powered by' badges. It's your assistant.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Ticket Creation",
    description:
      "When the AI can't help, create tickets on Jira, GitHub, Linear, or via email/webhook.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    title: "Knowledge Sources",
    description:
      "Feed your assistant with text, FAQs, URLs, or files. It knows what you want it to know.",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    ),
    title: "Open Source",
    description:
      "MIT licensed. Self-host on your infrastructure. Full control, zero vendor lock-in.",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Configure",
    description: "Set up your AI backend, branding, and topics in the admin dashboard.",
  },
  {
    step: "2",
    title: "Embed",
    description: "Copy one script tag. Paste into your HTML. Done.",
  },
  {
    step: "3",
    title: "Chat",
    description: "Your visitors get a fully branded AI assistant that stays on topic.",
  },
] as const;

export default function Home() {
  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        {/* Gradient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, var(--primary) 0%, transparent 70%)",
            opacity: 0.12,
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-0 -z-10 h-[500px] w-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
            opacity: 0.08,
          }}
        />

        <div className="mx-auto max-w-4xl px-6 pb-24 pt-32 text-center sm:pt-40">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Add an AI assistant to your website in <span className="text-primary">60 seconds</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Open source, fully customizable, self-hosted. One script tag is all it takes. No AI
            branding&nbsp;&mdash; your assistant, your brand.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/docs"
              className="rounded-lg bg-primary px-7 py-3 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-dark"
            >
              Get Started
            </a>
            <a
              href="/demo"
              className="rounded-lg border border-border px-7 py-3 text-base font-semibold transition-colors hover:bg-muted"
            >
              Live Demo
            </a>
          </div>

          {/* Embed snippet */}
          <div className="mx-auto mt-14 max-w-2xl">
            <div className="overflow-x-auto rounded-xl border border-border bg-muted/60 px-6 py-4 text-left backdrop-blur">
              <pre className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                <code>
                  <span style={{ color: "var(--muted-foreground)" }}>&lt;</span>
                  <span style={{ color: "var(--primary)" }}>script</span>{" "}
                  <span style={{ color: "var(--accent)" }}>src</span>
                  <span style={{ color: "var(--muted-foreground)" }}>=</span>
                  <span style={{ color: "var(--primary-light)" }}>
                    &quot;https://kody.codai.app/widget.js&quot;
                  </span>
                  {"\n       "}
                  <span style={{ color: "var(--accent)" }}>data-site-id</span>
                  <span style={{ color: "var(--muted-foreground)" }}>=</span>
                  <span style={{ color: "var(--primary-light)" }}>&quot;your-site&quot;</span>{" "}
                  <span style={{ color: "var(--accent)" }}>async</span>
                  <span style={{ color: "var(--muted-foreground)" }}>&gt;&lt;/</span>
                  <span style={{ color: "var(--primary)" }}>script</span>
                  <span style={{ color: "var(--muted-foreground)" }}>&gt;</span>
                </code>
              </pre>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              That&apos;s the entire integration. One line.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              A complete toolkit for embedding a smart, branded assistant on any site.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-background p-6 transition-shadow hover:shadow-lg"
              >
                <IconBox>{f.icon}</IconBox>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps. That&apos;s it.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              From zero to a working assistant on your site in minutes.
            </p>
          </div>

          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                  {s.step}
                </div>
                <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>

          {/* Connector line (decorative, hidden on mobile) */}
          <div
            aria-hidden="true"
            className="mx-auto mt-[-7.5rem] mb-[5.5rem] hidden h-0.5 max-w-md sm:block"
            style={{
              background: "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
              opacity: 0.25,
            }}
          />
        </div>
      </section>

      {/* ── Code example ─────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/40 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">One line of code</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            No npm packages. No build step. No framework integration. Just a single script tag and
            you&apos;re live.
          </p>

          <div className="mt-12 overflow-x-auto rounded-xl border border-border bg-[var(--foreground)] px-8 py-6 text-left shadow-2xl">
            <pre className="text-sm leading-loose sm:text-base">
              <code>
                {/* Line number gutter */}
                <span
                  className="mr-6 select-none"
                  style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
                >
                  1
                </span>
                <span style={{ color: "#9ca3af" }}>&lt;</span>
                <span style={{ color: "#f472b6" }}>script</span>{" "}
                <span style={{ color: "#7dd3fc" }}>src</span>
                <span style={{ color: "#9ca3af" }}>=</span>
                <span style={{ color: "#a5f3a3" }}>
                  &quot;https://kody.codai.app/widget.js&quot;
                </span>
                {"\n"}
                <span
                  className="mr-6 select-none"
                  style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
                >
                  {" "}
                </span>
                {"        "}
                <span style={{ color: "#7dd3fc" }}>data-site-id</span>
                <span style={{ color: "#9ca3af" }}>=</span>
                <span style={{ color: "#a5f3a3" }}>&quot;your-site&quot;</span>{" "}
                <span style={{ color: "#7dd3fc" }}>async</span>
                <span style={{ color: "#9ca3af" }}>&gt;&lt;/</span>
                <span style={{ color: "#f472b6" }}>script</span>
                <span style={{ color: "#9ca3af" }}>&gt;</span>
              </code>
            </pre>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Copy it. Paste it before{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                &lt;/body&gt;
              </code>
              . Your assistant is live.
            </p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              aria-label="Copy embed snippet"
              /* Copy functionality would need client JS; keeping as visual indicator */
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy snippet
            </button>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to add AI to your site?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            Get started in minutes. Free and open source, forever.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/docs"
              className="rounded-lg bg-primary px-7 py-3 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-dark"
            >
              Get Started
            </a>
            <a
              href="https://github.com/chafficui/kody"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-7 py-3 text-base font-semibold transition-colors hover:bg-muted"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          <p>Kody is open source under the MIT License.</p>
        </div>
      </footer>
    </main>
  );
}
