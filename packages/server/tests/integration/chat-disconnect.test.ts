import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { migrate } from "../../src/db/migrate.js";
import { createApp } from "../../src/app.js";
import type { SiteStore } from "../../src/services/site-store.js";

// Mock capability probe so it doesn't try to hit a real AI provider.
vi.mock("../../src/services/capability-probe.js", () => ({
  probeCapabilities: vi.fn().mockResolvedValue({
    supportsTools: false,
    supportsEmbeddings: false,
    checkedAt: Date.now(),
  }),
}));

// Mock the AI provider so we can assert that an AbortSignal is
// passed into the call (the chat route's req.on('close') handler
// aborts this controller — see packages/server/src/routes/chat.ts).
vi.mock("../../src/services/ai-provider.js", () => ({
  streamChatCompletion: vi.fn(),
}));

import { streamChatCompletion } from "../../src/services/ai-provider.js";
const mockedStream = vi.mocked(streamChatCompletion);

const validConfig = {
  siteId: "test-site",
  allowedOrigins: ["https://example.com"],
  ai: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  guardrails: {
    allowedTopics: ["billing"],
    topicDescription: "Help with billing.",
  },
  cache: { enabled: false, ttlSeconds: 3600, maxEntries: 1000 },
};

describe("POST /api/chat — abort signal plumbing", () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let siteStore: SiteStore;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    app = createApp({ db });
    siteStore = (app as unknown as { siteStore: SiteStore }).siteStore;
    siteStore.createSite(validConfig);
    mockedStream.mockReset();
  });

  afterEach(() => {
    db.close();
  });

  it("passes an AbortSignal into streamChatCompletion", async () => {
    let receivedSignal: AbortSignal | undefined;
    mockedStream.mockImplementationOnce(async (_config, _messages, callbacks, options) => {
      receivedSignal = options?.signal;
      callbacks.onToken("hi");
      callbacks.onDone();
      return { content: "hi", toolCalls: [], finishReason: "stop" };
    });

    await request(app)
      .post("/api/chat")
      .set("x-kody-site-id", "test-site")
      .set("Origin", "https://example.com")
      .send({ siteId: "test-site", message: "hi" });

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    // The signal should start not-aborted; it gets aborted later
    // when req.close fires (which supertest triggers at end-of-test
    // when the socket closes, but for the duration of a single
    // request the signal stays active).
    expect(receivedSignal?.aborted).toBe(false);
  });
});
