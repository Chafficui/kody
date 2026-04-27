<p align="center">
  <img src="https://kody.codai.app/kody.png" alt="Kody" width="80" />
</p>

<h1 align="center">Kody</h1>

<p align="center">
  Open-source embeddable AI chat assistant for any website.<br/>
  One script tag. Your AI. Your branding. Your rules.
</p>

<p align="center">
  <a href="https://github.com/Chafficui/kody/actions"><img src="https://github.com/Chafficui/kody/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
</p>

---

## What is Kody?

Kody lets you add a fully branded AI chat assistant to any website with a single `<script>` tag. You control which AI backend powers it (any OpenAI-compatible API), what topics it covers, how it looks, and where tickets go when it can't help.

- **Bring your own AI** — Works with OpenAI, Ollama, vLLM, llama.cpp, or any OpenAI-compatible endpoint
- **Three-layer guardrails** — Input filtering, system prompt enforcement, and output scrubbing keep conversations on-topic
- **No AI branding** — Provider names (ChatGPT, Claude, Llama, etc.) are automatically scrubbed from responses
- **Full customization** — Colors, name, logo, welcome message, position, and more
- **Shadow DOM isolation** — Widget styles never leak to or from the host page
- **Ticket creation** — Connect Jira, GitHub Issues, Linear, email, or a custom webhook
- **Knowledge sources** — Feed your assistant context via text, FAQ, URLs, or files
- **Admin dashboard** — Manage sites, branding, guardrails, and knowledge through a built-in UI at `/admin`

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/Chafficui/kody.git
cd kody
docker compose up -d
```

This starts the Kody server on port **3456** with Ollama as the AI backend. Open the admin dashboard at `http://localhost:3456/admin` and log in with the default credentials (`admin@example.com` / `changeme`).

Create a site, then embed the widget on any page:

```html
<script src="http://localhost:3456/widget.js" data-site-id="your-site-id" async></script>
```

### Manual

```bash
git clone https://github.com/Chafficui/kody.git
cd kody
pnpm install
pnpm build
```

Set the required environment variables (see `.env.example`), then start the server:

```bash
cd packages/server
node dist/index.js
```

## Architecture

Pnpm monorepo with 4 packages:

```
packages/
  shared/   — Zod schemas, TypeScript types, constants
  server/   — Express 5 API server, guardrails engine, admin API, SQLite database
  widget/   — Shadow DOM chat bubble (vanilla TS, Vite IIFE build, ~15KB gzipped)
  admin/    — Vite SPA dashboard served by the server at /admin
```

### How it works

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Widget   │────▶│  Kody Server │────▶│  AI Provider │
│ (browser) │◀────│  (Express 5) │◀────│  (your API)  │
└──────────┘ SSE └──────────────┘     └──────────────┘
                   │ ▲
                   │ │  Guardrails:
                   │ │  1. Input filter (injection, patterns, length)
                   │ │  2. System prompt (topic enforcement + knowledge)
                   │ └─ 3. Output scrubber (AI names, prompt leaks)
                   │
                   ▼
                 SQLite (sites, users, sessions)
```

## Configuration

Sites are configured through the admin dashboard at `/admin` or via the REST API.

Each site has:

| Section | What it controls |
|---|---|
| **Branding** | Name, tagline, logo, colors, position, welcome message |
| **AI** | Provider URL, API key, model, temperature, max tokens |
| **Guardrails** | Allowed topics, refusal message, blocked patterns, prompt injection detection |
| **Knowledge** | Text snippets, FAQs, URLs, files injected into context |
| **Tickets** | Jira, GitHub, Linear, email, or webhook for escalation |
| **Rate Limits** | Per-IP messages per minute/hour/day |

## Development

```bash
pnpm install          # install all dependencies
pnpm run dev          # start all dev servers in parallel
pnpm test             # run all tests (vitest)
pnpm run typecheck    # type-check all packages
pnpm run format       # format with prettier
```

### Running tests

```bash
pnpm test             # all tests
pnpm test -- --watch  # watch mode
```

338 tests covering validators, guardrails, middleware, routes, widget components, and utilities.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3456` | Server port |
| `DATABASE_PATH` | `./kody.db` | SQLite database file path |
| `ADMIN_EMAIL` | — | Initial admin user email (first boot) |
| `ADMIN_PASSWORD` | — | Initial admin user password (first boot) |
| `NODE_ENV` | `development` | Environment |

## Docker

**Development** (with Ollama):

```bash
docker compose up -d
```

**Production**:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Security

- API keys and secrets are stored server-side only and never sent to the browser
- Widget authentication uses `siteId` + browser-enforced `Origin` header validation
- Admin authentication uses argon2 password hashing and httpOnly session cookies
- Three-layer guardrail system protects against prompt injection and off-topic usage
- No `eval()`, no `innerHTML`, no inline event handlers in the widget

## Documentation

Full documentation is available at [kody.codai.app/docs](https://kody.codai.app/docs).

## License

[MIT](LICENSE) — use it for anything.
