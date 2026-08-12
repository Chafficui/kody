# Kody

Embeddable AI chat assistant widget. Open source (MIT). Self-hostable.

## Architecture

4-package pnpm monorepo:

- `packages/shared` — Zod schemas, types, constants (tsc build)
- `packages/server` — Express 5 proxy + guardrails + admin API (tsx for dev, tsc for build)
- `packages/widget` — Shadow DOM chat bubble, Vite IIFE build (~30KB gzip target)
- `packages/admin` — Vite SPA admin dashboard served by the server at /admin

## Commands

```bash
pnpm install          # install all deps
pnpm build            # build all packages
pnpm test             # run all tests (vitest)
pnpm run dev          # start all dev servers
pnpm run typecheck    # type check all packages
pnpm run format       # format with prettier
node scripts/check-hosting-leaks.mjs   # CI guardrail, runs in <5s
```

## Key Principles

- TDD: write tests before implementation
- No AI branding: never expose Claude, OpenAI, GPT, or any provider name to end users
- Server-side secrets: API keys, tokens, passwords never sent to browser
- Shadow DOM: widget is fully isolated from host page
- Three-layer guardrails: input filter → system prompt → output scrubber
- Self-hostable: a fresh `git clone && pnpm install && pnpm dev` must work with zero hosted-only assumptions. The CI guardrail enforces this — see `CONTRIBUTING.md` and `scripts/check-hosting-leaks.mjs`.

## Database

SQLite via better-sqlite3. Migrations in `packages/server/src/db/migrations/`.

## Testing

Vitest everywhere. Unit tests colocated in `__tests__/` or `tests/` directories.
Integration tests use supertest for server routes. Widget tests use jsdom.

## Common tasks (cheat sheet)

### Run the server in dev mode

```bash
pnpm install
pnpm --filter @kody/server run dev   # http://localhost:3456
```

### Run a single test file

```bash
pnpm --filter @kody/server test -- tests/integration/chat.test.ts
```

### Add a new tool (guardrail action)

1. Define the tool's input/output schemas in
   `packages/shared/src/types/` (Zod).
2. Implement the tool in `packages/server/src/services/tools/`.
3. Register it in the tool registry.
4. Add tests colocated with the implementation.
5. Run `pnpm test` and `pnpm run typecheck`.

### Add a new guardrail pattern

1. Add the pattern to the relevant service in
   `packages/server/src/services/guardrails/`.
2. Add a unit test in
   `packages/server/tests/unit/guardrails/<pattern>.test.ts`.
3. If the pattern is configurable per-site, add a field to
   `packages/shared/src/validators/site-config.ts` and a UI control in
   `packages/admin/src/pages/SiteEdit.tsx`.

### Add a docs page

Add a new `<topic>.md` file under `docs/` and link it from
`docs/README.md`. Code blocks are plain Markdown — no JSX components.

### Add a new env var

1. Add it to `.env.example` with a default value or empty placeholder.
2. Read it through `loadEnv()` in `packages/server/src/env.ts` with a
   Zod-validated schema.
3. Document it in the relevant `docs/*.md` file.
4. **Do not** name it after any hosted vendor key pattern
   (e.g. `STRIPE_*`, `SENDGRID_*`) — the hosting-leak guardrail will
   block the PR.

## CI

GitHub Actions runs on every push and PR. Jobs:

1. **test** — `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
2. **bundle-size** — keeps the widget under 30KB gzip.
3. **hosting-boundary** — runs `node scripts/check-hosting-leaks.mjs`
   to make sure no hosted-only references (vendor keys, hosted
   domains, hosted fork names) leak into the public repo.

The hosting-boundary guardrail runs in well under 5 seconds, so it's
safe to run locally before pushing.

## See also

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to file bugs, dev setup,
  PR review checklist, the hosting-boundary rule.
- [`README.md`](README.md) — the public-facing repo landing page.
- [`docs/`](docs/README.md) — architecture, security, and other
  contributor-facing documentation.
