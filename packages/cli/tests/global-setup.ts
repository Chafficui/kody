/**
 * Vitest globalSetup: assert the CLI has been built before tests run.
 *
 * The integration tests exec `dist/cli.js` directly, so running them
 * against a missing build is confusing. `pretest` already builds the
 * package, but `vitest run` directly bypasses pnpm scripts, so we add
 * a guard here. The guard is only a sanity check — the primary build
 * happens in the `pretest` pnpm script.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distCli = path.resolve(here, "..", "dist", "cli.js");

export default function setup(): void {
  if (!existsSync(distCli)) {
    throw new Error(
      `Missing build at ${distCli}. Run \`pnpm --filter @kody/cli build\` first.`,
    );
  }
}
