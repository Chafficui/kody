import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createServer, type Server as HttpServer } from "node:http";
import { request as httpRequest, type ClientRequest } from "node:http";
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
import { ConversationStore } from "../../src/services/conversation-store.js";
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
  let conversationStore: ConversationStore;
  let server: HttpServer | undefined;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    // Capture the store so we can destroy the 60s cleanup interval
    // in afterEach — otherwise vitest leaks the timer (and the
    // open SQLite handle behind it) across tests.
    conversationStore = new ConversationStore();
    app = createApp({ db, conversationStore });
    siteStore = (app as unknown as { siteStore: SiteStore }).siteStore;
    siteStore.createSite(validConfig);
    mockedStream.mockReset();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    conversationStore.destroy();
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

  it("aborts the in-flight stream when the client disconnects", async () => {
    // Hold the mocked stream open until we (the test) decide to
    // release it. We capture the signal passed in, the chunk
    // callback, and the abort-listener wiring so we can observe
    // the controller actually flip into the aborted state.
    let receivedSignal: AbortSignal | undefined;
    let resolveStream!: (result: {
      content: string;
      toolCalls: unknown[];
      finishReason: string;
    }) => void;
    const streamStarted = new Promise<void>((resolve) => {
      mockedStream.mockImplementationOnce(async (_config, _messages, callbacks, options) => {
        receivedSignal = options?.signal;
        // Emit a single token so the route's session-write path
        // runs and the SSE stream is actively flushing.
        callbacks.onToken("hi-");
        resolve();
        return new Promise<{
          content: string;
          toolCalls: unknown[];
          finishReason: string;
        }>((r) => {
          resolveStream = r;
        });
      });
    });

    // Use a real HTTP server (rather than supertest) so we have
    // a real TCP socket to destroy. supertest's buffered response
    // keeps the underlying socket alive even after `.abort()`, so
    // the server's `req.on("close")` handler never fires — which
    // defeats the point of this test.
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server!.address();
    if (!address || typeof address === "string") {
      throw new Error("test server failed to bind to a port");
    }

    const body = JSON.stringify({ siteId: "test-site", message: "hi" });
    const req: ClientRequest = httpRequest({
      host: "127.0.0.1",
      port: address.port,
      method: "POST",
      path: "/api/chat",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body).toString(),
        "x-kody-site-id": "test-site",
        origin: "https://example.com",
        // Disable HTTP/1.1 keep-alive so the server's
        // IncomingMessage fires `close` as soon as the request
        // is done — otherwise the connection sits in the
        // keep-alive pool and `close` is delayed until the
        // response is also fully written.
        connection: "close",
      },
    });
    req.on("error", () => {
      // We expect the server to RST the socket when we destroy
      // it below; the resulting ECONNRESET is benign.
    });
    const reqDone = new Promise<void>((resolve) => {
      req.on("close", () => resolve());
    });
    req.write(body);
    req.end();

    // Wait for the route to enter the stream.
    await streamStarted;
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(false);

    // Tear the underlying socket down. The server's
    // `IncomingMessage` socket fires `close` on socket
    // destruction, which makes the chat route's
    // `req.socket.on("close")` handler abort the AI controller.
    req.on("error", () => {
      // ECONNRESET is expected when we destroy mid-stream.
    });
    req.destroy();

    // Give the abort a tick to propagate to the listener. The
    // `close` event on the server's `IncomingMessage` only fires
    // after the underlying socket's read pipeline drains, which
    // can take a few event-loop iterations. Poll until the signal
    // flips (or the safety timeout kicks in) instead of guessing
    // a fixed number of setImmediate hops.
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline && receivedSignal && !receivedSignal.aborted) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(receivedSignal?.aborted).toBe(true);

    // Release the held stream so the route can return cleanly.
    resolveStream({ content: "hi-", toolCalls: [], finishReason: "stop" });
    await reqDone;
  });
});
