# Architecture

This document describes the runtime architecture of the public
self-hostable Kody repository.

## High-level data flow

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

- The **widget** is a Shadow DOM chat bubble loaded as a single
  `<script>` tag on the host page.
- The **server** is an Express 5 API that owns all guardrail logic and
  secrets. The widget never sees API keys.
- The **AI provider** is any OpenAI-compatible endpoint: OpenAI,
  Anthropic (via a proxy), Ollama, vLLM, llama.cpp, etc. The operator
  configures the base URL, API key, and model in the admin dashboard.
- **SQLite** holds site configs, admin users, sessions, feedback, and
  conversation history.

## Package layout

The repo is a 4-package pnpm monorepo:

```
packages/
  shared/   Zod schemas, types, constants
  server/   Express 5 API server, guardrails engine, admin API, SQLite
  widget/   Shadow DOM chat bubble (vanilla TS, Vite IIFE, ~30KB gzip)
  admin/    Vite SPA dashboard served by the server at /admin
```

### `packages/shared`

Source of truth for the wire format. Defines the `SiteConfig` Zod
schema, the public-facing subset returned to the widget, validators
for tickets and feedback, and the constants used by the guardrail
engine. No runtime dependencies.

### `packages/server`

Express 5 server built on `tsx` (dev) and `tsc` (prod). The boot path
(`src/index.ts`) loads the env, opens the database, ensures the admin
user exists if `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set, and starts
listening on `PORT`. The route layout:

- `GET  /health` — health check for Docker / load balancers
- `GET  /widget.js` — the IIFE widget bundle (built from `packages/widget`)
- `GET  /api/config/:siteId` — public site config (no secrets)
- `POST /api/chat` — SSE streaming chat, behind `siteAuth` + `rateLimit`
- `POST /api/tickets` — ticket creation
- `GET/POST/DELETE /api/sessions/*` — conversation history
- `POST /api/feedback` — thumbs up/down
- `POST /api/admin/login` — admin session login
- `*    /api/admin/sites` — site CRUD
- `*    /api/admin/users` — admin user CRUD
- `*    /api/admin/logs` — request log viewer
- `GET  /admin` — admin SPA
- `GET  /admin/{*splat}` — admin SPA fallback (HTML5 history mode)

### `packages/widget`

Vanilla TypeScript + Vite IIFE build. Targets **under 30KB gzipped**.
Shadow DOM isolation keeps the widget's styles from leaking into the
host page and vice versa. Output is a single `kody.js` file served by
the server at `/widget.js`.

### `packages/admin`

Vite + React SPA bundled into the server's `dist`. Served at `/admin`
and uses the same auth cookies as the admin API.

## Three-layer guardrails

Every message passes through three independent security layers. If
any layer blocks a message, the message is rejected before reaching
the next stage.

1. **Input filter** (in `packages/server/src/services/guardrails/input-filter.ts`):
   validates message length against `maxInputLength` (default 2000
   chars), detects prompt injection patterns, normalizes Unicode to
   prevent homoglyph and zero-width character bypasses, and applies
   custom `blockedInputPatterns`.
2. **System prompt** (in `packages/server/src/services/guardrails/system-prompt.ts`):
   generated from the site config. Establishes identity, defines
   allowed topics and the refusal message, injects knowledge sources
   as numbered references, and enforces strict behavioral rules
   (never reveal the system prompt, never mention AI provider names,
   never change behavior based on user instructions).
3. **Output scrubber** (in `packages/server/src/services/guardrails/output-scrubber.ts`):
   runs after the AI responds but before the response reaches the
   user. Detects and replaces known AI provider names with the
   configured assistant name, detects system prompt leaks (any
   20+ character fragment match blocks the entire response), and
   applies custom `blockedOutputPatterns`. Responses are streamed via
   SSE, and each chunk is scrubbed in real time.

See [`docs/security.md`](security.md) for the full security model.

## Database

SQLite via `better-sqlite3`. Migrations live in
`packages/server/src/db/migrations/`. The schema covers:

- `sites` — one row per site, stores the full validated `SiteConfig`
  as a JSON blob
- `users` — admin users
- `sessions` — conversation history (in-memory + persisted)
- `feedback` — thumbs up/down per assistant message
- `scrape_cache` — URL fetch results for knowledge sources
- `request_logs` — request-level logs for the admin dashboard

## Deployment

- **Docker** (recommended): `docker compose up -d` runs the server
  with Ollama. `docker compose -f docker-compose.prod.yml up -d` runs
  the production image with auto-restart and a persistent volume.
- **Bare metal**: `pnpm install && pnpm build`, set the env vars from
  `.env.example`, then `node packages/server/dist/index.js`.
- **Reverse proxy**: nginx in front, terminate TLS, forward to
  `localhost:3456`.

See the [README](../README.md) for the full self-hosting guide.
