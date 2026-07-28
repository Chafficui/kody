# @kody/shared

Single source of truth for the Kody data model. Every other package in the monorepo imports from here, and the public OpenAPI spec is generated from the Zod schemas in this directory.

## Layout

```
src/
├── constants/        Enums, blocked-pattern lists, server-wide limits
├── types/            TypeScript types (most are just z.infer<...>)
├── validators/       Zod schemas (the source of truth for validation)
└── openapi/          Hand-rolled zod → OpenAPI 3.1 mapper (used by the generator)
scripts/
└── generate-openapi.ts  Writes packages/shared/openapi.yaml
```

## OpenAPI generation

The `openapi.yaml` at the root of this package is **generated, not hand-written**. Re-generate it after changing any Zod schema:

```bash
pnpm --filter @kody/shared generate:openapi
```

The generator:

1. Walks the Zod validators in `src/validators/` and maps each one to a JSON Schema 2020-12 fragment (compatible with OpenAPI 3.1).
2. Composes the `paths` block from `src/openapi/paths.ts` (hand-written — there are only ~12 endpoints).
3. Emits a `components.schemas` block referencing every Zod schema under its own name.
4. Dumps the result as YAML with stable ordering and a `flowLevel: -1` (block style throughout) for clean diffs.

The file is **committed** so integrators can fetch it from a stable URL, but it remains **reproducible** by re-running the script. `tests/openapi.test.ts` enforces that the committed file parses back to the same object the generator builds.

## Why hand-roll the mapper?

We considered `@asteasolutions/zod-to-openapi` but the Kody schemas use a small set of Zod features (string/number/object/array/enum/literal/union/discriminated-union/optional/nullable/default/record) and we wanted full control over:

- The OpenAPI `description` (pulled from Zod's `.describe()`).
- The `pattern` / `format` mapping for strings (`.email()`, `.url()`, `.regex()`).
- The discriminator hint on `ZodDiscriminatedUnion` (Swagger UI uses it to render the right picker).
- Defaults — preserved as informational `default` fields, not removed by `z.infer`.

Adding a new schema or changing an existing one is a single file edit; the generator picks it up on the next run.

## When to add a `paths.ts` entry

Every public or admin endpoint that you want to appear in Swagger UI / `kody tools` codegen needs a hand-written entry in `src/openapi/paths.ts`. The entry should reference the matching `$ref` for body and response schemas so the docs stay in lock-step with the validators.

The `tags` array in the spec file is the human-readable grouping (`admin`, `sites`, `scraping`, …). Operations should pick the most specific tag, plus the general `admin` tag if they're admin-only.
