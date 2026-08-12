import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  generateFiles,
  renderEnvFile,
  renderEnvExample,
  renderEnvGitignore,
  renderDockerCompose,
  renderEmbedSnippet,
  AI_PROVIDER_PRESETS,
  isValidSiteId,
  type InitOptions,
} from "../src/lib/templates.js";

const sampleOpts: InitOptions = {
  siteId: "test-site",
  baseUrl: "http://localhost:11434/v1",
  model: "llama3.2",
  apiKey: "ollama",
  origin: "http://localhost:8080",
  adminEmail: "admin@example.com",
  adminPassword: "supersecret123",
  serverPort: 3456,
  serverUrl: "http://localhost:3456",
};

describe("templates", () => {
  it("validates site ids the same way the server does", () => {
    expect(isValidSiteId("test-site")).toBe(true);
    expect(isValidSiteId("a")).toBe(true);
    expect(isValidSiteId("123")).toBe(true);
    expect(isValidSiteId("Test-Site")).toBe(false);
    expect(isValidSiteId("test_site")).toBe(false);
    expect(isValidSiteId("test site")).toBe(false);
    expect(isValidSiteId("")).toBe(false);
    expect(isValidSiteId("a".repeat(101))).toBe(false);
  });

  it("renders .env with the right values", () => {
    const env = renderEnvFile(sampleOpts);
    expect(env).toContain("PORT=3456");
    expect(env).toContain("SITE_ID=test-site");
    expect(env).toContain("ALLOWED_ORIGIN=http://localhost:8080");
    expect(env).toContain("AI_BASE_URL=http://localhost:11434/v1");
    expect(env).toContain("AI_MODEL=llama3.2");
    // Secrets are single-quoted so embedded #, spaces, or newlines can't
    // truncate the value or turn the rest of the line into a comment.
    expect(env).toContain("AI_API_KEY='ollama'");
    expect(env).toContain("ADMIN_EMAIL=admin@example.com");
    expect(env).toContain("ADMIN_PASSWORD='supersecret123'");
  });

  it("renders .env.example with placeholders (no live secrets)", () => {
    const example = renderEnvExample(sampleOpts);
    // Non-secret fields mirror the user's chosen values — those are
    // expected to be the same in .env and .env.example.
    expect(example).toContain("PORT=3456");
    expect(example).toContain("SITE_ID=test-site");
    expect(example).toContain("ALLOWED_ORIGIN=http://localhost:8080");
    expect(example).toContain("AI_BASE_URL=http://localhost:11434/v1");
    expect(example).toContain("AI_MODEL=llama3.2");
    expect(example).toContain("ADMIN_EMAIL=admin@example.com");
    // Secret-bearing keys carry placeholders only — never the real value.
    expect(example).not.toContain("ollama");
    expect(example).not.toContain("supersecret123");
    expect(example).toContain("AI_API_KEY='replace-with-your-provider-key'");
    expect(example).toContain("ADMIN_PASSWORD='change-me-to-a-strong-secret'");
  });

  it("renders a .gitignore that covers .env, data/, and node_modules/", () => {
    const gi = renderEnvGitignore();
    // Each line on its own so a leading-space variant of .env is still
    // caught by a real operator grepping for ".env".
    expect(gi.split(/\r?\n/)).toContain(".env");
    expect(gi).toContain("data/");
    expect(gi).toContain("node_modules/");
  });

  it("generateFiles returns the six canonical files", () => {
    const files = generateFiles(sampleOpts);
    const names = files.map((f) => f.relativePath).sort();
    expect(names).toEqual(
      [".env", ".env.example", ".gitignore", "EMBED.md", "README.md", "docker-compose.yml"].sort(),
    );
  });

  it("escapes special characters in secret values (round-trip)", () => {
    // Every value we emit must survive a docker-compose / dotenv round
    // trip — i.e. the bytes between the outer single quotes must be
    // exactly what we want the parser to see. We use the Compose-style
    // backslash-apostrophe escape (docker-compose does not run values
    // through a shell) and turn raw newlines into \n so the line stays
    // a single line in the file.
    const cases: Array<{ name: string; value: string; expected: string }> = [
      { name: "apostrophe", value: "p'ss", expected: "p\\'ss" },
      { name: "backslash", value: "a\\b", expected: "a\\\\b" },
      { name: "newline", value: "line1\nline2", expected: "line1\\nline2" },
      { name: "hash", value: "sk#abc def", expected: "sk#abc def" },
    ];
    for (const c of cases) {
      const env = renderEnvFile({ ...sampleOpts, apiKey: c.value });
      // The escaped form sits between the outer single quotes — assert
      // that and that the line is still a single line (no raw \n).
      expect(env, `case ${c.name}`).toContain(`AI_API_KEY='${c.expected}'`);
      const lines = env.split("\n");
      const target = lines.find((l) => l.startsWith("AI_API_KEY="));
      expect(target, `AI_API_KEY line for ${c.name} must not contain a raw newline`).toBeDefined();
    }
  });

  it("renders a docker-compose.yml with the server port", () => {
    const compose = renderDockerCompose(sampleOpts);
    expect(compose).toContain("3456:3456");
    expect(compose).toContain("DATABASE_PATH=/data/kody.db");
    expect(compose).toContain("healthcheck");
  });

  it("renders an embed snippet that matches the widget's expected format", () => {
    const snippet = renderEmbedSnippet(sampleOpts);
    expect(snippet).toContain('data-site-id="test-site"');
    expect(snippet).toContain("/widget.js");
    // The widget reads `data-server-url` only as a fallback; we don't emit
    // it so the widget uses its script src origin.
    expect(snippet).not.toContain("data-server-url");
  });

  it("provides presets for the most common local providers", () => {
    const labels = AI_PROVIDER_PRESETS.map((p) => p.label);
    expect(labels).toContain("OpenAI");
    expect(labels.some((l) => l.toLowerCase().includes("ollama"))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes("vllm"))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes("llama"))).toBe(true);
  });
});

describe("CLI binary", () => {
  // The CLI runs as a separate process. We exec the built dist directly.
  // Use `fileURLToPath` (ESM-safe) rather than the CommonJS-only
  // `__dirname` to resolve the path, and assert the build exists up
  // front so a missing `dist/cli.js` fails with a clear message
  // instead of `MODULE_NOT_FOUND` later.
  const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
  if (!existsSync(cliPath)) {
    throw new Error(
      `Missing build at ${cliPath}. Run \`pnpm --filter @kody/cli build\` first.`,
    );
  }

  it("exposes --help and lists all three subcommands", () => {
    const out = execFileSync("node", [cliPath, "--help"], { encoding: "utf8" });
    expect(out).toContain("Usage: kody");
    expect(out).toContain("init");
    expect(out).toContain("doctor");
    expect(out).toContain("tools");
  });

  it("`init --help` documents every flag", () => {
    const out = execFileSync("node", [cliPath, "init", "--help"], { encoding: "utf8" });
    for (const flag of [
      "--non-interactive",
      "--server-dir",
      "--server-url",
      "--port",
      "--base-url",
      "--model",
      "--site-id",
      "--origin",
      "--admin-email",
    ]) {
      expect(out, `init --help should mention ${flag}`).toContain(flag);
    }
  });

  it("`doctor --help` documents its options", () => {
    const out = execFileSync("node", [cliPath, "doctor", "--help"], { encoding: "utf8" });
    expect(out).toContain("--server-url");
    expect(out).toContain("--site-id");
    expect(out).toContain("--json");
  });

  it("`tools test --help` documents its options", () => {
    const out = execFileSync("node", [cliPath, "tools", "test", "--help"], { encoding: "utf8" });
    expect(out).toContain("--server-url");
    expect(out).toContain("--args");
  });
});

describe("init --non-interactive", () => {
  const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

  it("writes the six canonical files with the right contents", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "kody-init-"));
    try {
      const serverDir = path.join(tmp, "kody-server");
      execFileSync(
        "node",
        [
          cliPath,
          "init",
          "--non-interactive",
          "--server-dir",
          serverDir,
          "--server-url",
          "http://localhost:3456",
          "--port",
          "3456",
          "--base-url",
          "http://localhost:11434/v1",
          "--model",
          "llama3.2",
          "--site-id",
          "my-site",
          "--origin",
          "http://localhost:8080",
          "--admin-email",
          "admin@example.com",
        ],
        {
          stdio: "pipe",
          env: { ...process.env, KODY_API_KEY: "ollama", KODY_ADMIN_PASSWORD: "password123" },
        },
      );

      // All six files exist (.env + .env.example + .gitignore + compose + embed + readme)
      for (const name of [".env", ".env.example", ".gitignore", "docker-compose.yml", "EMBED.md", "README.md"]) {
        const p = path.join(serverDir, name);
        expect(existsSync(p), `${name} should be created`).toBe(true);
      }

      // .env contains the user-supplied secrets (the live one)
      const env = readFileSync(path.join(serverDir, ".env"), "utf8");
      expect(env).toContain("SITE_ID=my-site");
      expect(env).toContain("ALLOWED_ORIGIN=http://localhost:8080");
      expect(env).toContain("AI_MODEL=llama3.2");
      expect(env).toContain("ADMIN_PASSWORD='password123'");
      // .env.example must NOT contain the live password
      const example = readFileSync(path.join(serverDir, ".env.example"), "utf8");
      expect(example).not.toContain("password123");
      // .gitignore must list .env so the live file never gets committed
      const gi = readFileSync(path.join(serverDir, ".gitignore"), "utf8");
      expect(gi.split(/\r?\n/)).toContain(".env");

      // EMBED.md contains the right snippet
      const embed = readFileSync(path.join(serverDir, "EMBED.md"), "utf8");
      expect(embed).toContain('data-site-id="my-site"');
      expect(embed).toContain("http://localhost:3456/widget.js");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("refuses an invalid site id", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "kody-init-"));
    try {
      let code = 0;
      try {
        execFileSync(
          "node",
          [
            cliPath,
            "init",
            "--non-interactive",
            "--server-dir",
            path.join(tmp, "x"),
            "--base-url",
            "http://localhost:11434/v1",
            "--model",
            "llama3.2",
            "--site-id",
            "Bad Site",
            "--origin",
            "http://localhost:8080",
            "--admin-email",
            "admin@example.com",
          ],
          {
            stdio: "pipe",
            env: { ...process.env, KODY_API_KEY: "ollama", KODY_ADMIN_PASSWORD: "password123" },
          },
        );
      } catch (err) {
        code = (err as { status: number }).status ?? 1;
      }
      expect(code).not.toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("refuses a too-short admin password", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "kody-init-"));
    try {
      let code = 0;
      let stderr = "";
      try {
        execFileSync(
          "node",
          [
            cliPath,
            "init",
            "--non-interactive",
            "--server-dir",
            path.join(tmp, "x"),
            "--base-url",
            "http://localhost:11434/v1",
            "--model",
            "llama3.2",
            "--site-id",
            "ok-site",
            "--origin",
            "http://localhost:8080",
            "--admin-email",
            "admin@example.com",
          ],
          {
            stdio: "pipe",
            env: { ...process.env, KODY_API_KEY: "ollama", KODY_ADMIN_PASSWORD: "short" },
          },
        );
      } catch (err) {
        code = (err as { status: number }).status ?? 1;
        stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? "";
      }
      expect(code).not.toBe(0);
      expect(stderr.toLowerCase()).toContain("password");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite an existing target without confirmation", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "kody-init-"));
    try {
      const serverDir = path.join(tmp, "kody-server");
      // Pre-create the directory with a marker file
      mkdirSync(serverDir, { recursive: true });
      writeFileSync(path.join(serverDir, "MARKER"), "do-not-delete", "utf8");

      let code = 0;
      try {
        execFileSync(
          "node",
          [
            cliPath,
            "init",
            "--non-interactive",
            "--server-dir",
            serverDir,
            "--base-url",
            "http://localhost:11434/v1",
            "--model",
            "llama3.2",
            "--site-id",
            "my-site",
            "--origin",
            "http://localhost:8080",
            "--admin-email",
            "admin@example.com",
          ],
          {
            stdio: "pipe",
            env: { ...process.env, KODY_API_KEY: "ollama", KODY_ADMIN_PASSWORD: "password123" },
          },
        );
      } catch (err) {
        code = (err as { status: number }).status ?? 1;
      }
      expect(code).not.toBe(0);
      // The marker file should still be there (we did NOT silently overwrite).
      expect(existsSync(path.join(serverDir, "MARKER"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

/** Run the CLI asynchronously and resolve to { code, stdout, stderr }. */
function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
    const child = spawn("node", [cliPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => {
      stdout += b.toString();
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

describe("doctor (against a fake server)", () => {
  // Spawning a node process takes a moment; vitest's default 5s timeout is
  // too tight when we have two sequential spawns in one test.
  const SPAWN_TIMEOUT = 20_000;

  /**
   * The fake server must run in a separate process because the CLI
   * process does blocking I/O against it — if the test process hosts
   * both, the parent's blocked event loop can't accept connections and
   * the CLI's requests time out. (We learned this the hard way.)
   *
   * The script is written to a temporary directory; the caller is
   * responsible for passing back the dir + child so they can be cleaned
   * up in the test's `finally` block.
   */
  function writeFakeServerScript(): { scriptPath: string; dir: string } {
    const dir = mkdtempSync(path.join(tmpdir(), "kody-fake-"));
    const scriptPath = path.join(dir, "server.cjs");
    writeFileSync(
      scriptPath,
      `const http = require("http");
const mode = process.env.MODE || "ok";
const server = http.createServer((req, res) => {
  if (mode === "down") {
    res.writeHead(503); res.end(); return;
  }
  if (mode === "degraded") {
    // Only /health is broken — everything else is fine. Mirrors a
    // server that is alive but its liveness probe is failing.
    if (req.url === "/health") {
      res.writeHead(503, {"Content-Type": "application/json"});
      res.end('{"status":"degraded"}');
      return;
    }
  }
  if (req.url === "/health") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({status:"ok", timestamp:new Date().toISOString()}));
    return;
  }
  if (req.url === "/openapi.yaml") {
    res.writeHead(200, {"Content-Type":"application/yaml"});
    res.end("openapi: 3.1.0\\n");
    return;
  }
  if (req.url === "/widget.js") {
    res.writeHead(200); res.end(); return;
  }
  if (req.url === "/api/config/ok-site") {
    res.writeHead(200, {"Content-Type":"application/json"});
    res.end('{"siteId":"ok-site"}');
    return;
  }
  res.writeHead(404); res.end();
});
server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  console.log("PORT=" + port);
});
`,
      "utf8",
    );
    return { scriptPath, dir };
  }

  /** Spawn the fake server in a child process and resolve to a handle. */
  function startFakeServer(
    mode: "ok" | "down" | "degraded",
  ): Promise<{ port: number; kill: () => void; cleanup: () => void }> {
    return new Promise((resolve, reject) => {
      const { scriptPath, dir } = writeFakeServerScript();
      const child: ChildProcess = spawn("node", [scriptPath], {
        env: { ...process.env, MODE: mode },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let resolved = false;
      let buffer = "";
      // Safety timer — if the child never prints PORT, fail loudly
      // rather than hang the test. We clear it on success so the test
      // process exits cleanly.
      const safetyTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          reject(new Error(`fake server did not print PORT within 5s. stdout so far: ${buffer}`));
        }
      }, 5000);
      const onChunk = (b: Buffer) => {
        buffer += b.toString();
        const m = buffer.match(/PORT=(\d+)/);
        if (!resolved && m) {
          resolved = true;
          clearTimeout(safetyTimer);
          resolve({
            port: parseInt(m[1], 10),
            kill: () => child.kill(),
            cleanup: () => {
              child.kill();
              rmSync(dir, { recursive: true, force: true });
            },
          });
        }
      };
      child.stdout?.on("data", onChunk);
      child.stderr?.on("data", () => {
        // swallow
      });
      child.on("error", reject);
      child.on("close", () => {
        clearTimeout(safetyTimer);
        if (!resolved) reject(new Error("fake server exited before printing PORT"));
      });
    });
  }

  it(
    "prints a JSON report and exits 0 when the server is healthy",
    { timeout: SPAWN_TIMEOUT },
    async () => {
      const fake = await startFakeServer("ok");
      try {
        const url = `http://127.0.0.1:${fake.port}`;
        const { code, stdout } = await runCli(["doctor", "--server-url", url, "--json", "--site-id", "ok-site"]);
        expect(code).toBe(0);
        const parsed = JSON.parse(stdout) as { overall: string; checks: Array<{ name: string; status: string }> };
        expect(parsed.overall).toBe("ok");
        const health = parsed.checks.find((c) => c.name === "health");
        expect(health?.status).toBe("ok");
        const openapi = parsed.checks.find((c) => c.name === "openapi");
        expect(openapi?.status).toBe("ok");
        const widget = parsed.checks.find((c) => c.name === "widget.js");
        expect(widget?.status).toBe("ok");
        const config = parsed.checks.find((c) => c.name === "config");
        expect(config?.status).toBe("ok");
      } finally {
        fake.cleanup();
      }
    },
  );

  it(
    "exits non-zero and reports 'fail' when /health is down",
    { timeout: SPAWN_TIMEOUT },
    async () => {
      const fake = await startFakeServer("down");
      try {
        const url = `http://127.0.0.1:${fake.port}`;
        const { code, stdout } = await runCli(["doctor", "--server-url", url, "--json"]);
        expect(code).not.toBe(0);
        const parsed = JSON.parse(stdout) as { overall: string; checks: Array<{ name: string; status: string }> };
        expect(parsed.overall).toBe("degraded");
        const health = parsed.checks.find((c) => c.name === "health");
        expect(health?.status).toBe("fail");
      } finally {
        fake.cleanup();
      }
    },
  );

  it(
    "reports degraded when only /health fails but the other endpoints work",
    { timeout: SPAWN_TIMEOUT },
    async () => {
      const fake = await startFakeServer("degraded");
      try {
        const url = `http://127.0.0.1:${fake.port}`;
        const { code, stdout } = await runCli([
          "doctor",
          "--server-url",
          url,
          "--json",
          "--site-id",
          "ok-site",
        ]);
        expect(code).not.toBe(0);
        const parsed = JSON.parse(stdout) as { overall: string; checks: Array<{ name: string; status: string }> };
        expect(parsed.overall).toBe("degraded");
        const health = parsed.checks.find((c) => c.name === "health");
        expect(health?.status).toBe("fail");
        // The other endpoints should still report ok.
        const openapi = parsed.checks.find((c) => c.name === "openapi");
        expect(openapi?.status).toBe("ok");
        const widget = parsed.checks.find((c) => c.name === "widget.js");
        expect(widget?.status).toBe("ok");
        const config = parsed.checks.find((c) => c.name === "config");
        expect(config?.status).toBe("ok");
      } finally {
        fake.cleanup();
      }
    },
  );
});
