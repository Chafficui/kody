# @kody/cli

The official CLI companion for the [Kody](https://github.com/Chafficui/kody) self-hosted AI chat widget. Two jobs:

1. **Scaffold a new self-hosted Kody server in under a minute.**
2. **Verify the server is up and the right endpoints respond.**

Targets Node 20+. Ships as a small ESM binary — no native deps, no installer. The full distribution is well under 200 KB.

## Install & quick start

```bash
# Run via npx (no install)
npx @kody/cli init
npx @kody/cli doctor
```

Or install globally:

```bash
npm i -g @kody/cli
kody init
```

> Until this package is published to npm, the canonical way to run it from the monorepo is `pnpm --filter @kody/cli dev` or `node packages/cli/dist/cli.js` after `pnpm build`.

## Commands

### `kody init`

Scaffold a new Kody server. Writes `.env.example`, `docker-compose.yml`, `EMBED.md`, and `README.md` into the target directory.

```bash
# Interactive — asks 7 questions
kody init

# Non-interactive — every value as a flag
kody init \
  --non-interactive \
  --base-url http://localhost:11434/v1 \
  --model llama3.2 \
  --api-key ollama \
  --site-id my-website \
  --origin http://localhost:8080 \
  --admin-email admin@example.com \
  --admin-password change-me-please
```

The interactive prompt offers presets for the most common OpenAI-compatible providers: OpenAI, Ollama (local), vLLM (local), and llama.cpp server. The generated `.env` mirrors the keys the server actually reads (`AI_BASE_URL`, `AI_MODEL`, etc.) and the `docker-compose.yml` references the official `ghcr.io/chafficui/kody:latest` image.

### `kody doctor`

Health-check a running Kody server. Exits non-zero if any check fails.

```bash
# Human-readable report
kody doctor --server-url http://localhost:3456

# Machine-readable JSON (for CI / status pages)
kody doctor --server-url http://localhost:3456 --json

# Probe a specific site
kody doctor --server-url http://localhost:3456 --site-id my-website
```

Checks performed:

| Check        | Path                     | Notes                                                |
|--------------|--------------------------|------------------------------------------------------|
| `health`     | `GET /health`            | Returns 200 with `status:"ok"`.                      |
| `config`     | `GET /api/config/:siteId`| Only run when `--site-id` is passed.                 |
| `openapi`    | `GET /openapi.yaml`      | Verifies the spec is reachable for SDK / codegen.    |
| `widget.js`  | `HEAD /widget.js`        | The IIFE the embed script loads.                     |

### `kody tools test <siteId> <toolName>`

Proxies a tool invocation to the admin test endpoint:

```
POST /api/admin/sites/:siteId/tools/:toolName/test
```

(Stream A adds this endpoint; the CLI returns a clear "endpoint not available" message on a 404 from older servers.)

```bash
kody tools test my-website search_crm \
  --token "$KODY_TOKEN" \
  --args '{"query": "latest order"}'
```

The auth token can also be set via the `KODY_TOKEN` environment variable. `--args` is a JSON object that's POSTed verbatim.

## What it doesn't do

- **No AI provider probing.** We deliberately don't make a real chat request during `doctor` — that needs a model that's known to work for the user's stack, and a flaky model shouldn't fail the health check. The admin UI surfaces provider errors instead.
- **No `git clone`-and-build.** The CLI assumes a Docker-based deployment so users without Node knowledge can still self-host. To work from source, follow the [self-hosting guide](../../README.md#docker) instead.
- **No auto-update.** This is a thin scaffolding tool, not a long-running agent. Pull the latest image and restart to upgrade.

## License

MIT — same as Kody.
