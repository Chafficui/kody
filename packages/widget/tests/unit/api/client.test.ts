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
    it("calls correct URL", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ siteId: "site-123" }), { status: 200 }));
      globalThis.fetch = mockFetch;

      await client.fetchConfig();

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/api/config/site-123");
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
});
