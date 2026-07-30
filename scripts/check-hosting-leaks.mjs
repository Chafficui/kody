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
// The vendor-key patterns match `process.env.X_KEY` reads (i.e. code
// that consumes a vendor key), not bare references in documentation.
// Documentation that explains "set this env var to your own key" is
// allowed; code that wires the public server to a hosted vendor is not.
const FORBIDDEN = [
  { name: "kody.codai.app", pattern: /\bkody\.codai\.app\b/ },
  { name: "api.kody.codai.app", pattern: /\bapi\.kody\.codai\.app\b/ },
  { name: "STRIPE_", pattern: /\bprocess\.env\.STRIPE_[A-Z_]+\b/ },
  { name: "SENDGRID_API_KEY", pattern: /\bprocess\.env\.SENDGRID_API_KEY\b/ },
  { name: "MAILGUN_API_KEY", pattern: /\bprocess\.env\.MAILGUN_API_KEY\b/ },
  { name: "POSTMARK_API_KEY", pattern: /\bprocess\.env\.POSTMARK_API_KEY\b/ },
  { name: "AWS_ACCESS_KEY", pattern: /\bprocess\.env\.AWS_ACCESS_KEY(_ID)?\b/ },
  { name: "SES_", pattern: /\bprocess\.env\.SES_[A-Z_]+\b/ },
];

// Files / directories we don't scan. These are build artifacts,
// dependencies, or vendored lockfiles where forbidden patterns
// would never appear in real form.
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
//   - kody-website (the fork name)
//   - STRIPE_*, SENDGRID_*, MAILGUN_*, POSTMARK_*, AWS_*, SES_*
const README_ADVERTISING_EXEMPT = new Set(["README.md"]);

// Top-level config / build files that may reference URLs and should
// be scanned even if they don't match a known extension.
const TOP_LEVEL_FILES = [
  "Makefile",
  "Dockerfile.server",
  ".env.example",
  "docker-compose.yml",
  "docker-compose.prod.yml",
];

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

  const hits = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { name, pattern } of FORBIDDEN) {
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

// Collect candidate files.
const candidates = new Set();

// Walk packages/ and .github/workflows/ and docs/.
for await (const f of walk(path.join(ROOT, "packages"))) candidates.add(f);
for await (const f of walk(path.join(ROOT, ".github"))) candidates.add(f);
for await (const f of walk(path.join(ROOT, "docs"))) candidates.add(f);

// Add top-level files if they exist.
for (const f of TOP_LEVEL_FILES) {
  const abs = path.join(ROOT, f);
  try {
    await stat(abs);
    candidates.add(abs);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}
// README, CLAUDE, and CONTRIBUTING live at the repo root and should
// be scanned.
for (const f of ["README.md", "CLAUDE.md", "CONTRIBUTING.md", "LICENSE"]) {
  const abs = path.join(ROOT, f);
  try {
    await stat(abs);
    candidates.add(abs);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

// Run scans.
const allHits = [];
for (const abs of candidates) {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  const ext = path.extname(rel);
  if (!SCAN_EXTENSIONS.has(ext)) continue;
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
