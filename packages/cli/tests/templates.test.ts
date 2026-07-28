import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import {
  generateFiles,
  renderEnvFile,
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
    expect(env).toContain("AI_API_KEY=ollama");
    expect(env).toContain("ADMIN_EMAIL=admin@example.com");
    expect(env).toContain("ADMIN_PASSWORD=supersecret123");
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

  it("generateFiles returns the four canonical files", () => {
    const files = generateFiles(sampleOpts);
    const names = files.map((f) => f.relativePath).sort();
    expect(names).toEqual([".env.example", "EMBED.md", "README.md", "docker-compose.yml"].sort());
  });
});

describe("CLI binary", () => {
  // The CLI runs as a separate process. We exec the built dist directly.
  const cliPath = path.resolve(__dirname, "..", "dist", "cli.js");

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
      "--base-url",
      "--model",
      "--api-key",
      "--site-id",
      "--origin",
      "--admin-email",
      "--admin-password",
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
    expect(out).toContain("--token");
    expect(out).toContain("--args");
  });
});

describe("init --non-interactive", () => {
  const cliPath = path.resolve(__dirname, "..", "dist", "cli.js");

  it("writes the four canonical files with the right contents", () => {
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
          "--base-url",
          "http://localhost:11434/v1",
          "--model",
          "llama3.2",
          "--api-key",
          "ollama",
          "--site-id",
          "my-site",
          "--origin",
          "http://localhost:8080",
          "--admin-email",
          "admin@example.com",
          "--admin-password",
          "password123",
        ],
        { stdio: "pipe" },
      );

      // All four files exist
      for (const name of [".env.example", "docker-compose.yml", "EMBED.md", "README.md"]) {
        const p = path.join(serverDir, name);
        expect(existsSync(p), `${name} should be created`).toBe(true);
      }

      // .env contains the user-supplied values
      const env = readFileSync(path.join(serverDir, ".env.example"), "utf8");
      expect(env).toContain("SITE_ID=my-site");
      expect(env).toContain("ALLOWED_ORIGIN=http://localhost:8080");
      expect(env).toContain("AI_MODEL=llama3.2");
      expect(env).toContain("ADMIN_PASSWORD=password123");

      // EMBED.md contains the right snippet
      const embed = readFileSync(path.join(serverDir, "EMBED.md"), "utf8");
      expect(embed).toContain('data-site-id="my-site"');
      expect(embed).toContain("http://localhost:8080/widget.js");
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
            "--api-key",
            "ollama",
            "--site-id",
            "Bad Site",
            "--origin",
            "http://localhost:8080",
            "--admin-email",
            "admin@example.com",
            "--admin-password",
            "password123",
          ],
          { stdio: "pipe" },
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
            "--api-key",
            "ollama",
            "--site-id",
            "ok-site",
            "--origin",
            "http://localhost:8080",
            "--admin-email",
            "admin@example.com",
            "--admin-password",
            "short",
          ],
          { stdio: "pipe" },
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
            "--api-key",
            "ollama",
            "--site-id",
            "my-site",
            "--origin",
            "http://localhost:8080",
            "--admin-email",
            "admin@example.com",
            "--admin-password",
            "password123",
          ],
          { stdio: "pipe" },
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
    const cliPath = path.resolve(__dirname, "..", "dist", "cli.js");
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

  // The fake server must run in a separate process because the CLI
  // process does blocking I/O against it — if the test process hosts
  // both, the parent's blocked event loop can't accept connections and
  // the CLI's requests time out. (We learned this the hard way.)
  function startFakeServerScript(): string {
    const path_ = require("node:path") as typeof import("node:path");
    const fs = require("node:fs") as typeof import("node:fs");
    const os = require("node:os") as typeof import("node:os");
    const dir = fs.mkdtempSync(path_.join(os.tmpdir(), "kody-fake-"));
    const scriptPath = path_.join(dir, "server.cjs");
    fs.writeFileSync(
      scriptPath,
      `const http = require("http");
const port = parseInt(process.env.PORT, 10);
const mode = process.env.MODE || "ok";
const server = http.createServer((req, res) => {
  if (mode === "down" || (req.url === "/health" && mode === "no-health")) {
    res.writeHead(503); res.end(); return;
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
server.listen(port, "127.0.0.1", () => {
  console.log("listening", port);
});
`,
      "utf8",
    );
    return scriptPath;
  }

  /** Spawn the fake server in a child process and resolve to {port, kill}. */
  function startFakeServer(mode: "ok" | "down"): Promise<{ port: number; kill: () => void }> {
    return new Promise((resolve, reject) => {
      const { spawn } = require("node:child_process") as typeof import("node:child_process");
      const net = require("node:net") as typeof import("node:net");
      const scriptPath = startFakeServerScript();
      // Bind a port ourselves so the child uses a known one.
      const srv = net.createServer();
      srv.listen(0, "127.0.0.1", () => {
        const addr = srv.address();
        if (!addr || typeof addr === "string") {
          srv.close();
          reject(new Error("failed to bind"));
          return;
        }
        const port = addr.port;
        srv.close(() => {
          const child = spawn("node", [scriptPath], {
            env: { ...process.env, PORT: String(port), MODE: mode },
            stdio: ["ignore", "pipe", "pipe"],
          });
          let resolved = false;
          child.stdout.on("data", (b: Buffer) => {
            if (!resolved && b.toString().includes("listening")) {
              resolved = true;
              resolve({ port, kill: () => child.kill() });
            }
          });
          child.stderr.on("data", () => {
            // swallow
          });
          child.on("error", reject);
          child.on("close", () => {
            if (!resolved) reject(new Error("fake server exited before listening"));
          });
        });
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
        fake.kill();
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
        fake.kill();
      }
    },
  );
});
