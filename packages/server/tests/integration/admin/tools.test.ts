import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../../src/db/migrate.js";
import { createApp } from "../../../src/app.js";
import { ToolExecutor } from "../../../src/services/tools/executor.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const baseConfig = {
  siteId: "test-site",
  allowedOrigins: ["https://example.com"],
  branding: {
    name: "TestBot",
    colors: {
      primary: "#4F46E5",
      primaryForeground: "#FFFFFF",
      background: "#FFFFFF",
      foreground: "#1F2937",
      bubbleBackground: "#F3F4F6",
      userBubbleBackground: "#4F46E5",
      userBubbleForeground: "#FFFFFF",
    },
    position: "bottom-right",
    welcomeMessage: "Hello!",
    inputPlaceholder: "Ask me anything...",
  },
  ai: {
    baseUrl: "http://localhost:11434/v1",
    apiKey: "test-key",
    model: "llama3",
  },
  guardrails: {
    allowedTopics: ["support"],
    topicDescription: "Customer support",
    blockedInputPatterns: [],
    blockedOutputPatterns: [],
  },
  knowledge: { sources: [] },
  tickets: {
    enabled: false,
    promptMessage: "",
    providers: [],
    requiredFields: ["email", "description"],
  },
  rateLimit: {
    messagesPerMinute: 10,
    messagesPerHour: 50,
    messagesPerDay: 200,
  },
  tools: {
    enabled: true,
    maxToolCalls: 5,
    customTools: [
      {
        name: "ping",
        description: "ping an endpoint",
        parameters: { type: "object", properties: {}, required: [] },
        endpoint: {
          url: "https://api.example.com/ping",
          method: "POST",
          headers: {},
          timeoutMs: 5000,
        },
      },
    ],
    builtinTools: { knowledgeSearch: true },
  },
  enabled: true,
};

describe("Admin Tools API", () => {
  let db: Database.Database;
  let token: string;
  let toolExecutor: ToolExecutor;

  beforeEach(async () => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);

    // Share one executor across every test app so handlers registered
    // (manually or via Toolkit.export()) survive across supertest calls
    // and across the multiple `createApp` instances in the assertions.
    toolExecutor = new ToolExecutor(null);

    const app = createApp({ db, toolExecutor });
    await app.authService.createUser("admin@test.com", "password123");
    const loginRes = await request(app).post("/api/admin/login").send({
      email: "admin@test.com",
      password: "password123",
    });
    token = loginRes.body.token;

    await request(app)
      .post("/api/admin/sites")
      .set("Authorization", `Bearer ${token}`)
      .send(baseConfig);
  });

  afterEach(() => {
    db.close();
    mockFetch.mockReset();
  });

  it("returns 401 without auth", async () => {
    const res = await request(createApp({ db, toolExecutor })).post(
      "/api/admin/sites/test-site/tools/ping/test",
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown site", async () => {
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/missing/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown tool name", async () => {
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ghost/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(404);
  });

  it("returns 400 when arguments are missing", async () => {
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when arguments are not an object", async () => {
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: "not-an-object" });
    expect(res.status).toBe(400);
  });

  it("returns 413 when arguments exceed MAX_ARG_BYTES", async () => {
    // 20 KB payload — well over the 16 KB MAX_ARG_BYTES cap.
    const big = { blob: "x".repeat(20 * 1024) };
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: big });
    expect(res.status).toBe(413);
    expect(res.body.error?.message).toMatch(/too large/i);
  });

  it("runs the tool and returns the response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: { x: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.name).toBe("ping");
    expect(res.body.result).toContain("ok");
    expect(res.body.tool.endpoint).toBe("https://api.example.com/ping");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns ok=false when the upstream tool fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.result).toContain("500");
  });

  it("truncates the response payload to 10 KB", async () => {
    const big = "x".repeat(20_000);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => big,
    });
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(true);
    expect(res.body.result.length).toBe(10_000);
    expect(Buffer.byteLength(res.body.result, "utf8")).toBe(10_000);
  });

  it("measures the argument size limit in UTF-8 bytes (not JS code units)", async () => {
    // Each "😀" is 1 JS code unit-pair (length 2) but 4 UTF-8 bytes.
    // 6_000 of them => 24_000 UTF-8 bytes, which must trip the 16 KB cap.
    const big = { blob: "😀".repeat(6_000) };
    expect(big.blob.length).toBe(12_000); // 6k code-unit pairs
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: big });
    expect(res.status).toBe(413);
    expect(res.body.error?.message).toMatch(/too large/i);
  });

  it("truncates multibyte responses on a UTF-8 boundary without splitting a char", async () => {
    // 5_000 "😀" => 20_000 UTF-8 bytes. The cap is 10_000 bytes; the cut
    // must NOT land inside a 4-byte sequence (which would emit a broken
    // code point on the wire).
    const big = "😀".repeat(5_000);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => big,
    });
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(true);
    const bytes = Buffer.byteLength(res.body.result, "utf8");
    expect(bytes).toBeLessThanOrEqual(10_000);
    // 10_000 / 4 = 2_500 complete emojis. The result must round-trip
    // through UTF-8 cleanly (no replacement chars from a partial cut).
    expect(res.body.result).toBe("😀".repeat(2_500));
  });

  it("runs the test against a draft tool definition supplied in the request body", async () => {
    // The draft URL is different from the saved one, so we know the
    // request body — not the saved site config — was used.
    const draftUrl = "https://api.example.com/draft-ping";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ source: "draft" }),
    });
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({
        arguments: { x: 1 },
        tool: {
          name: "ping",
          description: "draft ping",
          parameters: { type: "object", properties: {}, required: [] },
          endpoint: {
            url: draftUrl,
            method: "POST",
            headers: {},
            timeoutMs: 5000,
          },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.tool.endpoint).toBe(draftUrl);
    const [calledUrl] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(calledUrl).toBe(draftUrl);
  });

  it("rejects a draft tool with an invalid shape", async () => {
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({
        arguments: {},
        tool: { name: "ping", description: "bad", endpoint: { url: "not-a-url" } },
      });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/Invalid tool draft/);
  });

  it("rejects a draft tool whose URL is not https when auth is configured", async () => {
    const res = await request(createApp({ db, toolExecutor }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({
        arguments: {},
        tool: {
          name: "ping",
          description: "insecure auth",
          parameters: { type: "object", properties: {}, required: [] },
          endpoint: {
            url: "http://api.example.com/ping",
            method: "POST",
            headers: {},
            timeoutMs: 5000,
            auth: { type: "bearer", value: "abc", fromEnv: false },
          },
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/https/i);
  });
});
