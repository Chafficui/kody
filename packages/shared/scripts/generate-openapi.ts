/**
 * Generate `openapi.yaml` from the Zod validators + the hand-written paths.
 *
 * Usage:
 *   pnpm --filter @kody/shared generate:openapi
 *
 * The output is written to `packages/shared/openapi.yaml` (next to this
 * script's package root). The file is committed so consumers can fetch it
 * from a stable URL, but it remains reproducible by re-running this script.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import yaml from "js-yaml";
import { buildOpenApiSpec } from "../src/openapi/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(here, "..", "openapi.yaml");

const spec = buildOpenApiSpec();
const yamlText = yaml.dump(spec, {
  lineWidth: 120,
  noRefs: true,
  // Use block style throughout for readability and stable diffs.
  flowLevel: -1,
  sortKeys: false,
});

writeFileSync(outPath, yamlText, "utf8");

// eslint-disable-next-line no-console
console.log(`Wrote ${outPath} (${yamlText.length} bytes)`);
