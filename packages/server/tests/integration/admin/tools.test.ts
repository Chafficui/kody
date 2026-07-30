import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../../src/db/migrate.js";
import { createApp } from "../../../src/app.js";

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

  beforeEach(async () => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);

    const app = createApp({ db });
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
    const res = await request(createApp({ db })).post(
      "/api/admin/sites/test-site/tools/ping/test",
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown site", async () => {
    const res = await request(createApp({ db }))
      .post("/api/admin/sites/missing/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown tool name", async () => {
    const res = await request(createApp({ db }))
      .post("/api/admin/sites/test-site/tools/ghost/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(404);
  });

  it("returns 400 when arguments are missing", async () => {
    const res = await request(createApp({ db }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when arguments are not an object", async () => {
    const res = await request(createApp({ db }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: "not-an-object" });
    expect(res.status).toBe(400);
  });

  it("returns 413 when arguments exceed MAX_ARG_BYTES", async () => {
    // 20 KB payload — well over the 16 KB MAX_ARG_BYTES cap.
    const big = { blob: "x".repeat(20 * 1024) };
    const res = await request(createApp({ db }))
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
    const res = await request(createApp({ db }))
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
    const res = await request(createApp({ db }))
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
    const res = await request(createApp({ db }))
      .post("/api/admin/sites/test-site/tools/ping/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ arguments: {} });
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(true);
    expect(res.body.result.length).toBe(10_000);
  });
});
