import { describe, it, expect, beforeEach, vi } from "vitest";
import { KodyApiClient, type ChatEvent } from "../../../src/api/client.js";

function mockSSEResponse(events: string[]): Response {
  const body = events.map((e) => `data: ${e}\n\n`).join("");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("KodyApiClient", () => {
  let client: KodyApiClient;

  beforeEach(() => {
    client = new KodyApiClient("https://api.example.com", "site-123");
    vi.restoreAllMocks();
  });

  describe("fetchConfig", () => {
    it("calls correct URL with x-kody-site-id header", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ siteId: "site-123" }), { status: 200 }));
      globalThis.fetch = mockFetch;

      await client.fetchConfig();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/config/site-123",
        expect.objectContaining({
          headers: expect.objectContaining({ "x-kody-site-id": "site-123" }),
        }),
      );
    });

    it("throws on non-ok response", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("Not Found", { status: 404, statusText: "Not Found" }));

      await expect(client.fetchConfig()).rejects.toThrow("Failed to fetch config: 404 Not Found");
    });
  });

  describe("sendMessage", () => {
    it("posts to correct URL with correct headers and body", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockSSEResponse([]));
      globalThis.fetch = mockFetch;

      await client.sendMessage("hello", "sess-1", { onEvent: vi.fn() });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/chat",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kody-site-id": "site-123",
          },
          body: JSON.stringify({
            siteId: "site-123",
            sessionId: "sess-1",
            message: "hello",
          }),
        }),
      );
    });

    it("parses SSE events and calls onEvent for each", async () => {
      const events = [
        JSON.stringify({ type: "session", sessionId: "s1" }),
        JSON.stringify({ type: "delta", content: "Hi" }),
        JSON.stringify({ type: "done" }),
      ];
      globalThis.fetch = vi.fn().mockResolvedValue(mockSSEResponse(events));

      const onEvent = vi.fn();
      await client.sendMessage("hello", undefined, { onEvent });

      expect(onEvent).toHaveBeenCalledTimes(3);
      expect(onEvent).toHaveBeenCalledWith({ type: "session", sessionId: "s1" });
      expect(onEvent).toHaveBeenCalledWith({ type: "delta", content: "Hi" });
      expect(onEvent).toHaveBeenCalledWith({ type: "done" });
    });

    it("handles connection errors gracefully (calls onEvent with error type)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      const onEvent = vi.fn();
      await client.sendMessage("hello", undefined, { onEvent });

      expect(onEvent).toHaveBeenCalledWith({
        type: "error",
        message: "Network failure",
      });
    });
  });

  describe("identity gating for untrusted origins", () => {
    it("withholds x-kody-user-id, traits, and context when baseUrl is plain http", async () => {
      const insecure = new KodyApiClient("http://api.example.com", "site-123");
      const fetchMock = vi.fn().mockResolvedValue(mockSSEResponse([]));
      globalThis.fetch = fetchMock;

      insecure.setIdentity({ userId: "u-1", traits: { plan: "pro" } });
      insecure.setUserContext({ page: "checkout" });

      await insecure.sendMessage("hi", "sess", { onEvent: vi.fn() });

      const chatCall = fetchMock.mock.calls.find((c) => (c[0] as string).includes("/api/chat"));
      const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
      // Only the public site id should be present; identity / context
      // must NOT be forwarded to a plain-HTTP origin.
      expect(headers["x-kody-site-id"]).toBe("site-123");
      expect(headers["x-kody-user-id"]).toBeUndefined();
      expect(headers["x-kody-user-traits"]).toBeUndefined();
      expect(headers["x-kody-user-context"]).toBeUndefined();
    });

    it("forwards identity headers to https:// origins", async () => {
      const secure = new KodyApiClient("https://api.example.com", "site-123");
      const fetchMock = vi.fn().mockResolvedValue(mockSSEResponse([]));
      globalThis.fetch = fetchMock;

      secure.setIdentity({ userId: "u-1", traits: { plan: "pro" } });
      secure.setUserContext({ page: "checkout" });

      await secure.sendMessage("hi", "sess", { onEvent: vi.fn() });

      const chatCall = fetchMock.mock.calls.find((c) => (c[0] as string).includes("/api/chat"));
      const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-kody-user-id"]).toBe("u-1");
      expect(headers["x-kody-user-traits"]).toBe(JSON.stringify({ plan: "pro" }));
      expect(headers["x-kody-user-context"]).toBe(JSON.stringify({ page: "checkout" }));
    });

    it("forwards identity headers to http://localhost (loopback dev exception)", async () => {
      const local = new KodyApiClient("http://localhost:3000", "site-123");
      const fetchMock = vi.fn().mockResolvedValue(mockSSEResponse([]));
      globalThis.fetch = fetchMock;

      local.setIdentity({ userId: "u-1" });

      await local.sendMessage("hi", undefined, { onEvent: vi.fn() });

      const chatCall = fetchMock.mock.calls.find((c) => (c[0] as string).includes("/api/chat"));
      const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-kody-user-id"]).toBe("u-1");
    });
  });

  describe("trySerialize UTF-8 byte sizing", () => {
    it("drops a multi-byte payload whose UTF-8 size exceeds the cap even when char count would fit", () => {
      // 4-byte emoji; one char, four UTF-8 bytes. With the prior
      // string-length check, ~7000 of these would fit in a 4096 char
      // budget but blow up the header. The byte-aware check should
      // drop anything past ~1024 emoji.
      const insecure = new KodyApiClient("https://api.example.com", "site-123");
      const fetchMock = vi.fn().mockResolvedValue(mockSSEResponse([]));
      globalThis.fetch = fetchMock;

      // 2000 emoji, each 1 char / 4 UTF-8 bytes: char length 2000 (fits
      // the old 4096 cap), UTF-8 size 8000 (should be dropped).
      const manyEmoji = { tag: "🌍".repeat(2000) };
      insecure.setUserContext(manyEmoji);

      return insecure.sendMessage("hi", undefined, { onEvent: vi.fn() }).then(() => {
        const chatCall = fetchMock.mock.calls.find(
          (c) => (c[0] as string).includes("/api/chat"),
        );
        const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
        expect(headers["x-kody-user-context"]).toBeUndefined();
      });
    });

    it("keeps an ASCII payload that fits within the byte cap", () => {
      const secure = new KodyApiClient("https://api.example.com", "site-123");
      const fetchMock = vi.fn().mockResolvedValue(mockSSEResponse([]));
      globalThis.fetch = fetchMock;

      secure.setUserContext({ page: "checkout", cart: 3 });

      return secure.sendMessage("hi", undefined, { onEvent: vi.fn() }).then(() => {
        const chatCall = fetchMock.mock.calls.find(
          (c) => (c[0] as string).includes("/api/chat"),
        );
        const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
        expect(headers["x-kody-user-context"]).toBe(JSON.stringify({ page: "checkout", cart: 3 }));
      });
    });
  });
});
