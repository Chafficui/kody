import Link from "next/link";

const sections = [
  {
    href: "/docs/getting-started",
    title: "Getting Started",
    description:
      "Install Kody, create your first site, and embed the widget on your page in five minutes.",
  },
  {
    href: "/docs/configuration",
    title: "Configuration",
    description:
      "Full schema reference for every field: branding, AI provider, guardrails, knowledge, tickets, and rate limits.",
  },
  {
    href: "/docs/security",
    title: "Security",
    description:
      "Three-layer guardrails, prompt injection detection, output scrubbing, CORS origin validation, and admin authentication.",
  },
  {
    href: "/docs/ticket-providers",
    title: "Ticket Providers",
    description:
      "Connect Jira, GitHub Issues, Linear, email, or a custom webhook so users can create support tickets from the chat.",
  },
  {
    href: "/docs/knowledge-sources",
    title: "Knowledge Sources",
    description:
      "Feed your assistant with inline text, FAQ pairs, URLs (auto-cached), and local files to give it expert context.",
  },
  {
    href: "/docs/self-hosting",
    title: "Self-Hosting",
    description:
      "Deploy with Docker Compose, systemd, or bare Node.js. Covers nginx reverse proxy, backups, and environment variables.",
  },
];

export default function DocsPage() {
  return (
    <article>
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Documentation</h1>
      <p className="mb-2 text-lg text-muted-foreground">
        Welcome to the Kody documentation. Kody is an open-source, embeddable AI chat widget you can
        add to any website with a single script tag.
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        Built with Shadow DOM isolation, three-layer guardrails, and support for any
        OpenAI-compatible AI backend. ~8 KB gzipped. MIT licensed.
      </p>
      <p className="mb-10 text-sm font-medium text-primary">Get started in 5 minutes.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-lg border border-border p-5 transition-colors hover:border-primary/40 hover:bg-muted"
          >
            <h2 className="mb-1 text-lg font-semibold group-hover:text-primary">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-10 rounded-lg border border-border bg-muted/50 p-5">
        <h2 className="mb-3 text-lg font-semibold">Quick Links</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <a
              href="https://github.com/chafficui/kody"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              GitHub Repository
            </a>{" "}
            &mdash; source code, issues, and contributions
          </li>
          <li>
            <a
              href="/demo"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Interactive Demo
            </a>{" "}
            &mdash; configure and preview the widget live
          </li>
          <li>
            <a
              href="https://kody.codai.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              kody.codai.app
            </a>{" "}
            &mdash; production instance and hosted widget
          </li>
        </ul>
      </div>
    </article>
  );
}
