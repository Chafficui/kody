import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../../src/db/migrate.js";
import { createApp } from "../../../src/app.js";

const validSiteConfig = {
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
    temperature: 0.7,
    maxTokens: 1000,
  },
  guardrails: {
    allowedTopics: ["support"],
    topicDescription: "Customer support",
    refusalMessage: "I can only help with support topics.",
    blockedInputPatterns: [],
    blockedOutputPatterns: [],
    maxInputLength: 2000,
    enablePromptInjectionDetection: true,
    enableOutputScrubbing: true,
  },
  knowledge: {
    sources: [],
    maxContextTokens: 4000,
  },
  tickets: {
    enabled: false,
    promptMessage: "Would you like to create a ticket?",
    providers: [],
    requiredFields: ["email", "description"],
  },
  rateLimit: {
    messagesPerMinute: 10,
    messagesPerHour: 50,
    messagesPerDay: 200,
  },
  enabled: true,
};

describe("Admin Sites API", () => {
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
  });

  afterEach(() => {
    db.close();
  });

  function makeApp() {
    return createApp({ db });
  }

  describe("GET /api/admin/sites", () => {
    it("returns 401 without auth", async () => {
      const res = await request(makeApp()).get("/api/admin/sites");
      expect(res.status).toBe(401);
    });

    it("returns empty array initially", async () => {
      const res = await request(makeApp())
        .get("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("POST /api/admin/sites", () => {
    it("creates a new site", async () => {
      const res = await request(makeApp())
        .post("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`)
        .send(validSiteConfig);

      expect(res.status).toBe(201);
      expect(res.body.siteId).toBe("test-site");
    });

    it("returns 409 for duplicate siteId", async () => {
      const app = makeApp();
      await request(app)
        .post("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`)
        .send(validSiteConfig);

      const res = await request(app)
        .post("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`)
        .send(validSiteConfig);

      expect(res.status).toBe(409);
    });

    it("returns 400 for invalid config", async () => {
      const res = await request(makeApp())
        .post("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`)
        .send({ siteId: "bad" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/admin/sites/:siteId", () => {
    it("returns a specific site", async () => {
      const app = makeApp();
      await request(app)
        .post("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`)
        .send(validSiteConfig);

      const res = await request(app)
        .get("/api/admin/sites/test-site")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.siteId).toBe("test-site");
    });

    it("returns 404 for nonexistent site", async () => {
      const res = await request(makeApp())
        .get("/api/admin/sites/nonexistent")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/admin/sites/:siteId", () => {
    it("updates an existing site", async () => {
      const app = makeApp();
      await request(app)
        .post("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`)
        .send(validSiteConfig);

      const updated = {
        ...validSiteConfig,
        branding: { ...validSiteConfig.branding, name: "UpdatedBot" },
      };

      const res = await request(app)
        .put("/api/admin/sites/test-site")
        .set("Authorization", `Bearer ${token}`)
        .send(updated);

      expect(res.status).toBe(200);
      expect(res.body.branding.name).toBe("UpdatedBot");
    });

    it("returns 404 for nonexistent site", async () => {
      const res = await request(makeApp())
        .put("/api/admin/sites/nonexistent")
        .set("Authorization", `Bearer ${token}`)
        .send(validSiteConfig);

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/sites/:siteId", () => {
    it("deletes a site", async () => {
      const app = makeApp();
      await request(app)
        .post("/api/admin/sites")
        .set("Authorization", `Bearer ${token}`)
        .send(validSiteConfig);

      const res = await request(app)
        .delete("/api/admin/sites/test-site")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const getRes = await request(app)
        .get("/api/admin/sites/test-site")
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.status).toBe(404);
    });

    it("returns 404 for nonexistent site", async () => {
      const res = await request(makeApp())
        .delete("/api/admin/sites/nonexistent")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
