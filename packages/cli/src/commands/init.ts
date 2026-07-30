/**
 * `kody init` — scaffold a new self-hosted Kody server.
 *
 * Interactive mode walks through 7 questions and writes 4 files into the
 * target directory. Non-interactive mode (`--non-interactive`) requires
 * every flag and skips the readline prompts entirely.
 *
 * Two important UX invariants:
 *   1. The `origin` flag is the customer's website origin (used for CORS
 *      and the embed snippet). The `--server-url` flag (or derived
 *      `http://localhost:<port>`) is the address of the Kody server
 *      itself. These are almost never the same value.
 *   2. Secrets (`AI_API_KEY`, `ADMIN_PASSWORD`) are NEVER accepted as
 *      flags — they're read from env vars (`KODY_API_KEY`,
 *      `KODY_ADMIN_PASSWORD`) or via hidden prompts so they don't leak
 *      into shell history or process listings.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  generateFiles,
  AI_PROVIDER_PRESETS,
  isValidSiteId,
  type InitOptions,
} from "../lib/templates.js";
import { ask, askSecret, choose, confirm, closeRl } from "../lib/prompts.js";

interface InitCommandOptions {
  nonInteractive: boolean;
  serverDir?: string;
  serverUrl?: string;
  port?: number;
  baseUrl?: string;
  model?: string;
  siteId?: string;
  origin?: string;
  adminEmail?: string;
}

function randomSiteId(): string {
  return "site-" + randomBytes(4).toString("hex");
}

function generatePassword(): string {
  // 16 chars from [a-zA-Z0-9] — fine for a self-hosted admin bootstrap.
  return randomBytes(12).toString("base64url").slice(0, 16);
}

export async function initCommand(opts: InitCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const targetDir = path.resolve(cwd, opts.serverDir ?? "./kody-server");

  if (existsSync(targetDir)) {
    if (opts.nonInteractive) {
      throw new Error(
        `Target directory already exists: ${targetDir}. Pass --server-dir to a fresh location.`,
      );
    }
    const overwrite = await confirm(
      `Target directory ${targetDir} already exists. Overwrite the generated files?`,
      false,
    );
    if (!overwrite) {
      console.log("Aborted.");
      await closeRl();
      return;
    }
  }

  let baseUrl = opts.baseUrl;
  let model = opts.model;
  let siteId = opts.siteId;
  let origin = opts.origin;
  let adminEmail = opts.adminEmail;
  // Secrets: never read from CLI flags. Prefer env vars (CI / scripts);
  // fall back to a hidden prompt in interactive mode.
  let apiKey = process.env.KODY_API_KEY;
  let adminPassword = process.env.KODY_ADMIN_PASSWORD;
  // Server URL: explicit flag wins, otherwise derived from --port.
  let serverUrl = opts.serverUrl;
  const port = opts.port ?? 3456;

  if (!opts.nonInteractive) {
    if (!baseUrl) {
      const presetLabels = AI_PROVIDER_PRESETS.map((p) => `${p.label} (${p.baseUrl})`);
      const idx = await choose("Which AI provider are you using?", presetLabels, 1);
      const preset = AI_PROVIDER_PRESETS[idx];
      baseUrl = await ask("Base URL", preset.baseUrl);
    }
    if (!model) {
      const defaultModel = baseUrl?.includes("11434") ? "llama3.2" : "gpt-4o-mini";
      model = await ask("Model name", defaultModel);
    }
    if (!apiKey) {
      const defaultKey = baseUrl?.includes("11434")
        ? "ollama"
        : baseUrl?.includes("api.openai.com")
          ? "sk-..."
          : "EMPTY";
      // Hidden input: never echo the secret on screen.
      apiKey = await askSecret("AI API key (or 'ollama' / 'EMPTY' for local)", defaultKey);
    }
    if (!siteId) {
      siteId = await ask("Site id (lowercase, alphanumeric, dashes)", randomSiteId());
    }
    if (!origin) {
      origin = await ask("Allowed origin for the embed widget", "http://localhost:8080");
    }
    if (!adminEmail) {
      adminEmail = await ask("Admin email", "admin@example.com");
    }
    if (!adminPassword) {
      // The default is a strong generated password; if the user just hits
      // enter we use it. We never echo the generated password back.
      const generated = generatePassword();
      adminPassword = await askSecret("Admin password (min 8 chars; enter to use generated)", generated);
    }
    if (!serverUrl) {
      serverUrl = await ask("Where will the server listen?", `http://localhost:${port}`);
    }
  }

  // Required-field validation (covers both modes). The error mentions
  // KODY_API_KEY / KODY_ADMIN_PASSWORD / --server-url so the user knows
  // how to fix it from any of the supported flows.
  const required: Array<[string, string | undefined]> = [
    ["--base-url", baseUrl],
    ["--model", model],
    ["AI_API_KEY (env KODY_API_KEY or interactive)", apiKey],
    ["--site-id", siteId],
    ["--origin", origin],
    ["--admin-email", adminEmail],
    ["ADMIN_PASSWORD (env KODY_ADMIN_PASSWORD or interactive)", adminPassword],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required options: ${missing.join(", ")}`);
  }

  // Type validation — the server will validate on the wire, but we can give
  // nicer error messages here.
  if (!isValidSiteId(siteId!)) {
    throw new Error(
      `Invalid --site-id "${siteId}". Must match /^[a-z0-9-]+$/ and be 1-100 chars.`,
    );
  }
  try {
    // eslint-disable-next-line no-new
    new URL(origin!);
  } catch {
    throw new Error(`Invalid --origin "${origin}". Must be a full URL like http://localhost:8080.`);
  }
  try {
    // eslint-disable-next-line no-new
    new URL(baseUrl!);
  } catch {
    throw new Error(`Invalid --base-url "${baseUrl}".`);
  }
  if (adminPassword!.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }
  if (!serverUrl) {
    serverUrl = `http://localhost:${port}`;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(serverUrl);
  } catch {
    throw new Error(`Invalid --server-url "${serverUrl}". Must be a full URL like http://localhost:3456.`);
  }
  const serverUrlClean = serverUrl.replace(/\/$/, "");

  const initOpts: InitOptions = {
    siteId: siteId!,
    baseUrl: baseUrl!,
    model: model!,
    apiKey: apiKey!,
    origin: origin!,
    adminEmail: adminEmail!,
    adminPassword: adminPassword!,
    serverPort: port,
    serverUrl: serverUrlClean,
  };

  mkdirSync(targetDir, { recursive: true });
  const files = generateFiles(initOpts);
  for (const f of files) {
    writeFileSync(path.join(targetDir, f.relativePath), f.contents, "utf8");
  }

  await closeRl();

  console.log("");
  console.log(`✔ Wrote ${files.length} files to ${targetDir}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${path.relative(cwd, targetDir) || "."}`);
  console.log("  cp .env.example .env   # edit secrets if needed");
  console.log("  docker compose up -d");
  console.log("");
  console.log(`Then verify:`);
  console.log(`  npx kody doctor --server-url ${serverUrlClean}`);
  console.log("");
  console.log("Embed the widget on your site:");
  console.log("");
  console.log(
    `  <script src="${serverUrlClean}/widget.js" data-site-id="${siteId}" async></script>`,
  );
  console.log("");
  console.log(`(Allowed origin is "${origin}" — adjust in the admin UI if it changes.)`);
  console.log("");
}
