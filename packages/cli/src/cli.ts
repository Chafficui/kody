#!/usr/bin/env node
/**
 * `kody` — CLI entry point.
 *
 * Subcommands:
 *   init       Scaffold a new self-hosted Kody server (interactive or non-interactive)
 *   doctor     Health-check a running Kody server
 *   tools test Run a custom tool against the server's admin test endpoint
 *
 * The binary targets Node 20+ and ships as ESM. We deliberately avoid
 * inquirer/chalk to keep the install small (the binary is ~120 KB after
 * tsc) and to work in any terminal without color/TTY detection.
 */
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { doctorCommand } from "./commands/doctor.js";
import { toolsTestCommand } from "./commands/tools.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.resolve(here, "..", "package.json"), "utf8"),
) as { name: string; version: string };

const program = new Command();
program
  .name("kody")
  .description("CLI for the Kody self-hosted AI chat widget")
  .version(pkg.version)
  .showHelpAfterError();

program
  .command("init")
  .description("Scaffold a new self-hosted Kody server (interactive or --non-interactive)")
  .option("--non-interactive", "don't ask questions; require every flag", false)
  .option("--server-dir <dir>", "where to write the server files", "./kody-server")
  .option("--server-url <url>", "where the server will listen (e.g. http://localhost:3456); used by generated docs and `kody doctor`")
  .option("--port <port>", "server port the docker-compose / healthcheck bind to", (v) => {
    // Reject non-integer input explicitly. `Number.parseInt` accepts
    // strings like "3456abc" (parses 3456 and stops) and "1.5"
    // (parses 1), so we use `Number(v)` and `Number.isInteger` to fail
    // fast on either. The range check is unchanged.
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      throw new Error(`Invalid --port "${v}". Must be a whole number between 1 and 65535.`);
    }
    return n;
  }, 3456)
  .option("--base-url <url>", "OpenAI-compatible base URL (e.g. http://localhost:11434/v1)")
  .option("--model <name>", "model name to call")
  .option("--site-id <id>", "site id (lowercase, alphanumeric, dashes)")
  .option("--origin <url>", "allowed origin for the embed widget")
  .option("--admin-email <email>", "initial admin email")
  .action(initCommand);

program
  .command("doctor")
  .description("Check that a running Kody server is healthy and reachable")
  .option("--server-url <url>", "server base URL", "http://localhost:3456")
  .option("--site-id <id>", "site id to test config for (optional)")
  .option("--json", "emit machine-readable JSON instead of a human report", false)
  .action(doctorCommand);

const tools = program
  .command("tools")
  .description("Tool management helpers");

tools
  .command("test <siteId> <toolName>")
  .description("Run a custom tool against POST /api/admin/sites/:siteId/tools/:toolName/test")
  .option("--server-url <url>", "server base URL", "http://localhost:3456")
  .option("--args <json>", "tool arguments as a JSON object", "{}")
  .action(toolsTestCommand);

program.parseAsync(process.argv).catch((err) => {
  // Commander already prints its own errors and exits; this only fires for
  // unexpected exceptions thrown inside an action handler.
  console.error(`kody: ${(err as Error).message ?? err}`);
  process.exit(1);
});
