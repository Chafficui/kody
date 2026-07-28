# @kody/tools

Pre-built tool definitions and a fluent toolkit builder for the Kody platform.
No hosted assumptions — every tool is public-API-only; you wire the secrets.

## Quick start

```ts
import { Toolkit, webhook, slack, linear, sendgridEmail } from "@kody/tools";

const toolkit = new Toolkit()
  .add(webhook("https://hooks.zapier.com/abc/", { secret: process.env.ZAPIER_SECRET }))
  .add(slack({ token: process.env.SLACK_TOKEN, channel: "#support" }))
  .add(linear({ apiKey: process.env.LINEAR_API_KEY, teamId: "engineering" }))
  .add(sendgridEmail({ apiKey: process.env.SENDGRID_API_KEY, from: "bot@example.com" }));

const { customTools, builtinTools, handlers } = toolkit.export();
// Drop `customTools` into SiteConfig.tools.customTools.
// Merge `handlers` into the server's ToolRegistry at startup.
```

## Available pre-built tools

| Factory                    | What it does                                  |
|----------------------------|-----------------------------------------------|
| `httpGet` / `httpPost`     | Agent-driven HTTP with optional `jsonPath`    |
| `webhook(url, opts?)`      | POST a signed payload to a fixed URL           |
| `slack({ token, channel })`| Post a message via Slack `chat.postMessage`   |
| `linear({ apiKey, teamId })`| Create an issue in a Linear team              |
| `sendgridEmail({...})`     | Send a transactional email via SendGrid v3    |

Each factory returns a `Tool` object (definition + handler). Pass the
result straight to `Toolkit.add(tool)`.

## Auth & signing

Auth happens at construction time so the agent loop never reads
`process.env` itself:

- `webhook(url, { secret })` — HMAC-SHA256 in `X-Kody-Signature`
- `webhook(url, { auth: { type: "bearer", value } })` — bearer auth
- `webhook(url, { auth: { type: "apiKey", value, headerName } })` — named header
- `webhook(url, { auth: { fromEnv: true, value: "ENV_NAME" } })` — resolve at call time
- `webhook(url, { retry: { maxAttempts, baseDelayMs } })` — exponential backoff on 5xx/429

The same auth / retry shape is available on raw custom HTTP tools via the
`endpoint.auth` and `endpoint.retry` fields in the SiteConfig schema.

## Server wiring

The server ships a `ToolRegistry` on every `ToolExecutor`. At startup:

```ts
import { ToolExecutor } from "./services/tools/executor.js";

const executor = new ToolExecutor(retriever);
executor.getRegistry().merge(myToolkit.export().handlers);
```

When the agent loop calls a tool, the executor checks the registry first;
only registered-in-process tools avoid the HTTP round-trip. Unknown tools
fall back to the custom HTTP tool defined in the SiteConfig.

## Low-level HTTP

`httpCall` and `pluckPath` are exported for custom tooling:

```ts
import { httpCall, pluckPath } from "@kody/tools";

const r = await httpCall({
  url: "https://api.example.com/v1/items",
  method: "GET",
  auth: { type: "bearer", value: process.env.API_TOKEN },
  retry: { maxAttempts: 3, baseDelayMs: 200 },
});
const first = pluckPath(r.json, "data.items.0.name");
```

## Scripts

```bash
pnpm --filter @kody/tools build
pnpm --filter @kody/tools test
```
