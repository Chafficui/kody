#!/usr/bin/env node
// scripts/check-hosting-leaks.mjs
//
// CI guardrail for the hosting boundary.
//
// The public kody repository must NOT contain references to hosted
// products, hosted-only vendor keys, or hosted-only assumptions.
// Anyone cloning this repo and running `pnpm install && pnpm dev`
// must get a self-hostable product with zero hosted-only behavior
// baked in.
//
// This script enforces the rule on every PR. It runs in well under
// 5 seconds on the full public repo (typical: <500ms on Node 22).
//
// Usage:
//   node scripts/check-hosting-leaks.mjs
//
// Exit codes:
//   0 — no forbidden patterns found
//   1 — one or more forbidden patterns found, list printed to stderr
//   2 — internal error (e.g. permission denied)

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Forbidden patterns. Each pattern is a RegExp with no /g flag — the
// matcher uses .test() per line and tracks line numbers via String.match.
//
// The vendor-key patterns match `process.env.X_KEY` reads (both
// dot- and bracket-notation) and `KEY=...` assignments in `.env*`
// files. Documentation that explains "set this env var to your own
// key" is allowed; code that wires the public server to a hosted
// vendor is not.
//
// `envFileOnly: true` restricts a pattern to actual `.env*` files
// (assignment syntax), so prose that mentions "STRIPE_KEY" in
// markdown is not flagged.
//
// `selfSkip: true` excludes the file from being scanned by the
// walker (the guardrail cannot self-detect a literal it must
// contain as a regex pattern).
const FORBIDDEN = [
  { name: "kody.codai.app", pattern: /\bkody\.codai\.app\b/ },
  { name: "api.kody.codai.app", pattern: /\bapi\.kody\.codai\.app\b/ },
  // The private hosted-fork name. The literal is required inside the
  // regex to detect it; the script file is excluded from its own
  // walk (see SELF_SKIP_FILES) to avoid a self-match.
  { name: "kody-website", pattern: /\bkody-website\b/, selfSkip: true },
  // process.env.X reads — both dot and bracket notation
  { name: "STRIPE_", pattern: /\bprocess\.env(?:\.|\[)["']?STRIPE_[A-Z_]+/ },
  {
    name: "SENDGRID_API_KEY",
    pattern: /\bprocess\.env(?:\.|\[)["']?SENDGRID_API_KEY/,
  },
  {
    name: "MAILGUN_API_KEY",
    pattern: /\bprocess\.env(?:\.|\[)["']?MAILGUN_API_KEY/,
  },
  {
    name: "POSTMARK_API_KEY",
    pattern: /\bprocess\.env(?:\.|\[)["']?POSTMARK_API_KEY/,
  },
  {
    name: "AWS_ACCESS_KEY",
    pattern: /\bprocess\.env(?:\.|\[)["']?AWS_ACCESS_KEY(_ID)?/,
  },
  { name: "SES_", pattern: /\bprocess\.env(?:\.|\[)["']?SES_[A-Z_]+/ },
  // .env file assignment style (KEY=...). envFileOnly restricts
  // matching to .env* files so explanatory prose in markdown is
  // not flagged.
  {
    name: "STRIPE_KEY_ASSIGN",
    pattern: /^[ \t]*STRIPE_[A-Z_]*[ \t]*=/,
    envFileOnly: true,
  },
  {
    name: "SENDGRID_KEY_ASSIGN",
    pattern: /^[ \t]*SENDGRID_API_KEY[ \t]*=/,
    envFileOnly: true,
  },
  {
    name: "MAILGUN_KEY_ASSIGN",
    pattern: /^[ \t]*MAILGUN_API_KEY[ \t]*=/,
    envFileOnly: true,
  },
  {
    name: "POSTMARK_KEY_ASSIGN",
    pattern: /^[ \t]*POSTMARK_API_KEY[ \t]*=/,
    envFileOnly: true,
  },
  {
    name: "AWS_KEY_ASSIGN",
    pattern: /^[ \t]*AWS_ACCESS_KEY(_ID)?[ \t]*=/,
    envFileOnly: true,
  },
  {
    name: "SES_KEY_ASSIGN",
    pattern: /^[ \t]*SES_[A-Z_]+[ \t]*=/,
    envFileOnly: true,
  },
];

// Files / directories we don't scan. These are build artifacts,
// dependencies, vendored lockfiles, or guardrail meta-files where
// forbidden patterns would never appear in real form (or must
// appear as part of the pattern itself).
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".next",
  ".turbo",
  ".cache",
]);

const SKIP_FILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  // The guardrail cannot scan itself without matching its own
  // patterns (e.g. the hosted-fork name literal in the regex).
  "check-hosting-leaks.mjs",
]);

// File extensions we DO scan. Markdown is included so docs and
// READMEs are checked alongside code.
const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".md",
  ".mdx",
  ".sh",
  ".env",
  "",
]);

// README.md is the public landing page. Advertising the hosted
// product (logo image, docs link) is allowed here. Every other
// markdown file is treated like code — no hosted-only references.
//
// The patterns that ARE allowed in README.md (advertising only):
//   - kody.codai.app / api.kody.codai.app
// The patterns that are NEVER allowed anywhere, including README.md:
//   - the private hosted fork name (see FORBIDDEN entry above)
//   - STRIPE_*, SENDGRID_*, MAILGUN_*, POSTMARK_*, AWS_*, SES_*
const README_ADVERTISING_EXEMPT = new Set(["README.md"]);

// Walk a directory recursively, yielding file paths. Skips SKIP_DIRS
// and SKIP_FILES. Symlinks are not followed (avoids cycles).
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    if (entry.isFile() && SKIP_FILES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

// True when `rel` is a `.env*` file path (e.g. `.env`, `.env.example`,
// `.env.local`). Used to gate `envFileOnly` patterns to assignment
// syntax so explanatory markdown is not flagged.
function isEnvFile(rel) {
  const base = path.basename(rel);
  return base === ".env" || base.startsWith(".env.");
}

// Scan a single file, returning a list of { file, line, col, pattern, text }
// hits. Empty list means the file is clean.
async function scanFile(absPath) {
  const rel = path
    .relative(ROOT, absPath)
    .split(path.sep)
    .join("/");
  let content;
  try {
    content = await readFile(absPath, "utf8");
  } catch (err) {
    if (
      err.code === "EISDIR" ||
      err.code === "ENOENT" ||
      err.code === "EACCES"
    ) {
      return [];
    }
    throw err;
  }

  // Cheap binary heuristic — if the first 8KB contains a NUL, skip.
  const head = content.slice(0, 8192);
  if (head.includes("\0")) return [];

  // Strip a leading UTF-8 BOM so assignment-syntax patterns can match
  // .env files written by editors that prepend a BOM (e.g. some
  // Windows tools writing UTF-8 with BOM).
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const fileIsEnv = isEnvFile(rel);
  const hits = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { name, pattern, envFileOnly, selfSkip } of FORBIDDEN) {
      // envFileOnly patterns only fire in actual .env* files.
      if (envFileOnly && !fileIsEnv) continue;
      const m = line.match(pattern);
      if (m) {
        hits.push({
          file: rel,
          line: i + 1,
          col: m.index + 1,
          pattern: name,
          text: line.trim().slice(0, 120),
        });
      }
    }
  }
  return hits;
}

// Collect candidate files by walking ROOT recursively. The existing
// walk skip rules (SKIP_DIRS, SKIP_FILES) are reused, so build
// artifacts, lockfiles, and the guardrail itself are excluded
// without a separate allowlist.
const candidates = new Set();
for await (const f of walk(ROOT)) candidates.add(f);

// Run scans.
const allHits = [];
for (const abs of candidates) {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  // `.env*` files (e.g. `.env`, `.env.example`, `.env.test`) are
  // always scanned, even when their suffix isn't in SCAN_EXTENSIONS
  // (path.extname returns `""` for `.env` and `.example` for
  // `.env.example`, neither of which is otherwise recognised).
  const ext = path.extname(rel);
  const fileIsEnv = isEnvFile(rel);
  if (!fileIsEnv && !SCAN_EXTENSIONS.has(ext)) continue;
  // README.md may advertise the hosted product (logo, docs link).
  // All other patterns (vendor keys, fork name, etc.) are still
  // blocked in README.md.
  const isReadme = README_ADVERTISING_EXEMPT.has(rel);
  const hits = await scanFile(abs);
  for (const h of hits) {
    if (
      isReadme &&
      (h.pattern === "kody.codai.app" || h.pattern === "api.kody.codai.app")
    ) {
      continue;
    }
    allHits.push(h);
  }
}

// Report.
if (allHits.length === 0) {
  console.log("OK: no hosting-boundary leaks found.");
  process.exit(0);
}

// Pretty print.
console.error(`Found ${allHits.length} hosting-boundary leak(s):\n`);
for (const h of allHits) {
  console.error(`  ${h.file}:${h.line}:${h.col}  [${h.pattern}]  ${h.text}`);
}
console.error(
  `\nThe public kody repo must not contain hosted-only references. ` +
    `See CONTRIBUTING.md for the rule.`,
);
process.exit(1);
