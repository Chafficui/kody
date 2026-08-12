# Contributing to Kody

Thanks for your interest in Kody! This project is an open-source
embeddable AI chat assistant. We welcome bug reports, feature
requests, documentation improvements, and pull requests.

## Code of conduct

This project follows the
[Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
By participating, you agree to its terms. In short: be welcoming, be
patient, assume good faith, and prioritize the community over being
right.

## How to file a bug

1. **Check existing issues** — search the
   [issue tracker][issues] for the symptom. If you find a match, add a
   👍 and any extra context; don't file a duplicate.
2. **Open a new issue** with:
   - A clear, one-line title (e.g. "Widget fails to render when
     `data-site-id` contains uppercase letters").
   - Steps to reproduce, including the smallest possible config.
   - What you expected vs. what happened.
   - Server logs, browser console, and your `kody` version / commit
     hash.

[issues]: https://github.com/Chafficui/kody/issues

## How to file a feature request

1. Search the issue tracker for an existing discussion. Add a 👍 if
   you find one.
2. Open a new issue and mark it as a **feature request**. Describe:
   - The problem the feature solves.
   - The proposed shape of the API or UI.
   - Any alternatives you considered.

## How to set up the dev environment

Requirements:

- **Node.js 22+** (the CI uses Node 22; older versions may work but
  aren't tested).
- **pnpm 9+** (the repo pins pnpm 10 in CI; pnpm 9 should also work).
- **Git**.

Setup:

```bash
git clone https://github.com/Chafficui/kody.git
cd kody
pnpm install
pnpm build              # builds all four packages once
pnpm run dev            # starts the server, widget dev server, and admin dev server
```

The dev server runs on `http://localhost:3456`. Open
`http://localhost:3456/admin` to access the admin dashboard. The
default credentials in `.env.example` are `admin@example.com` /
`changeme` — change these before deploying anything.

A working AI backend is required for end-to-end testing. Any
OpenAI-compatible API works (OpenAI, Ollama, vLLM, llama.cpp, etc.).
Update the AI base URL and API key from the admin dashboard.

## How to run tests

```bash
pnpm test                    # all packages, one-shot
pnpm test -- --watch         # watch mode for a single package
pnpm run typecheck           # tsc --noEmit across all packages
```

The full test suite is vitest, with unit tests colocated in
`__tests__/` or `tests/` directories and integration tests in
`tests/integration/`. The suite is fast — runs in seconds.

If your change is small and you're only touching one package, scope
your test run to that package:

```bash
pnpm --filter @kody/server test
pnpm --filter @kody/widget test
```

## Pull request checklist

Before opening a PR, make sure:

- [ ] The change works end-to-end (`pnpm dev` → widget chat with your
      fix).
- [ ] Tests cover the change. New behavior needs a test; bug fixes
      need a regression test.
- [ ] `pnpm run typecheck` is clean.
- [ ] `pnpm test` is clean.
- [ ] `pnpm run format` has been run.
- [ ] The CI guardrail passes locally:
      `node scripts/check-hosting-leaks.mjs`.
- [ ] Commit messages follow the existing convention
      (`type(scope): subject` — e.g. `fix(widget): handle empty site id`).

## The hosting-boundary rule

This is the single most important rule for contributors.

**The public `kody` repository must stay deployable as a self-hosted
product without any hosted-only assumptions.** That means:

- The public repo **must not** hardcode any specific hosted fork
  identifier or any business-sensitive integration detail.
- The public repo **must not** ship a default config that assumes
  any hosted product (e.g. an `allowedOrigins` entry pointing at a
  hosted domain, or a default `siteId` that names a hosted site).
- A self-hosted user cloning this repo and running
  `pnpm install && pnpm dev` must get a working product with **zero**
  hosted-only assumptions baked in.
- Vendor-specific billing, email, or analytics keys
  (`STRIPE_*`, `SENDGRID_*`, `MAILGUN_*`, `POSTMARK_*`, `AWS_*`,
  `SES_*`) **must not** appear anywhere in the public repo.
- `README.md` may link to the hosted product (logo, docs) as
  advertising — that's the one place where hosted URLs are allowed.
  Every other file in the public repo, including every other
  markdown file, must follow the same rule as code.

The CI guardrail at `scripts/check-hosting-leaks.mjs` enforces this
rule. A PR that violates it will fail CI before review.

## PR review checklist

For reviewers:

- [ ] The change matches the issue's acceptance criteria (or the PR
      description, if there's no linked issue).
- [ ] Tests cover the new behavior or regression.
- [ ] The diff doesn't introduce hosted-only references — check the
      `node scripts/check-hosting-leaks.mjs` output in the CI log.
- [ ] No secrets, API keys, or `console.log` debug statements.
- [ ] Public API changes are reflected in `docs/` (if a public doc
      applies).
- [ ] Commit messages are clean and scoped.
- [ ] If a new env var was added, it's documented in `.env.example`
      and in the relevant `docs/*.md` file.

## License

By contributing, you agree that your contributions will be licensed
under the project's [MIT license](LICENSE).
