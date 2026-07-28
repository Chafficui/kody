import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { httpCall, pluckPath } from "../src/http.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("httpCall", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns ok=true on 2xx with parsed JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: "x" }),
    });
    const r = await httpCall({ url: "https://x.test", method: "GET" });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ data: "x" });
  });

  it("returns ok=false on 500 with text body preserved", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    const r = await httpCall({ url: "https://x.test", method: "GET" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
    expect(r.text).toBe("boom");
  });

  it("signs body with HMAC-SHA256 when secret is set", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    await httpCall({
      url: "https://x.test",
      method: "POST",
      body: { a: 1 },
      secret: "shh",
    });
    const [, opts] = mockFetch.mock.calls[0];
    const expected = createHmac("sha256", "shh").update(opts.body).digest("hex");
    expect(opts.headers["X-Kody-Signature"]).toBe(expected);
  });

  it("applies bearer auth", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    await httpCall({
      url: "https://x.test",
      method: "GET",
      auth: { type: "bearer", value: "abc" },
    });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe("Bearer abc");
  });

  it("applies apiKey auth with custom header name", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    await httpCall({
      url: "https://x.test",
      method: "GET",
      auth: { type: "apiKey", value: "k", headerName: "X-Api-Key" },
    });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["X-Api-Key"]).toBe("k");
  });

  it("retries on transient 503 and succeeds on second attempt", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "down" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "{}" });
    const r = await httpCall({
      url: "https://x.test",
      method: "GET",
      retry: { maxAttempts: 2, baseDelayMs: 5 },
    });
    expect(r.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx (non-transient)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => "bad" });
    const r = await httpCall({
      url: "https://x.test",
      method: "GET",
      retry: { maxAttempts: 3, baseDelayMs: 5 },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns a network-error result when fetch throws", async () => {
    mockFetch.mockRejectedValue(new TypeError("ECONNREFUSED"));
    const r = await httpCall({ url: "https://x.test", method: "GET" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
    expect(r.text).toContain("ECONNREFUSED");
  });

  it("serialises JSON body as query string for GET", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    await httpCall({ url: "https://x.test", method: "GET", body: { a: 1, b: "two" } });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("a=1");
    expect(url).toContain("b=two");
  });
});

describe("pluckPath", () => {
  it("returns nested values", () => {
    expect(pluckPath({ a: { b: { c: 7 } } }, "a.b.c")).toBe(7);
  });
  it("returns fallback when path is missing", () => {
    expect(pluckPath({ a: 1 }, "a.b.c", "fallback")).toBe("fallback");
  });
  it("returns the value when path is empty", () => {
    expect(pluckPath({ a: 1 }, "")).toEqual({ a: 1 });
  });
});
