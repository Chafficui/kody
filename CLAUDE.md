# Kody

Embeddable AI chat assistant widget. Open source (MIT).

## Architecture

4-package pnpm monorepo:

- `packages/shared` — Zod schemas, types, constants (tsc build)
- `packages/server` — Express 5 proxy + guardrails + admin API (tsx for dev, tsc for build)
- `packages/widget` — Shadow DOM chat bubble, Vite IIFE build (~30KB gzip target)
- `packages/web` — Next.js + Tailwind 4 marketing/docs/admin site

## Commands

```bash
pnpm install          # install all deps
pnpm build            # build all packages
pnpm test             # run all tests (vitest)
pnpm run dev          # start all dev servers
pnpm run typecheck    # type check all packages
pnpm run format       # format with prettier
```

## Key Principles

- TDD: write tests before implementation
- No AI branding: never expose Claude, OpenAI, GPT, or any provider name to end users
- Server-side secrets: API keys, tokens, passwords never sent to browser
- Shadow DOM: widget is fully isolated from host page
- Three-layer guardrails: input filter → system prompt → output scrubber

## Database

SQLite via better-sqlite3. Migrations in `packages/server/src/db/migrations/`.

## Testing

Vitest everywhere. Unit tests colocated in `__tests__/` or `tests/` directories.
Integration tests use supertest for server routes. Widget tests use jsdom.
