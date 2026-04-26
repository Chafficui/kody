import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSessionId,
  setSessionId,
  clearSession,
  generateSessionId,
  getStoredMessages,
  storeMessages,
  clearStoredMessages,
  getWidgetState,
  setWidgetState,
} from "../../../src/utils/session.js";

describe("session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("setSessionId + getSessionId round-trip", () => {
    setSessionId("site1", "abc-123");
    expect(getSessionId("site1")).toBe("abc-123");
  });

  it("clearSession removes the session", () => {
    setSessionId("site1", "abc-123");
    clearSession("site1");
    expect(getSessionId("site1")).toBeNull();
  });

  it("getSessionId returns null when not set", () => {
    expect(getSessionId("nonexistent")).toBeNull();
  });

  it("generateSessionId returns a UUID-like string", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("message persistence", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
  });

  it("stores and retrieves messages", () => {
    const msgs = [
      { role: "user" as const, content: "hello" },
      { role: "assistant" as const, content: "hi there" },
    ];
    storeMessages("site1", msgs);
    expect(getStoredMessages("site1")).toEqual(msgs);
  });

  it("returns empty array when no messages stored", () => {
    expect(getStoredMessages("nonexistent")).toEqual([]);
  });

  it("clearStoredMessages removes messages", () => {
    storeMessages("site1", [{ role: "user", content: "test" }]);
    clearStoredMessages("site1");
    expect(getStoredMessages("site1")).toEqual([]);
  });

  it("isolates messages by siteId", () => {
    storeMessages("site1", [{ role: "user", content: "a" }]);
    storeMessages("site2", [{ role: "user", content: "b" }]);
    expect(getStoredMessages("site1")[0].content).toBe("a");
    expect(getStoredMessages("site2")[0].content).toBe("b");
  });
});

describe("widget state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores and retrieves widget state", () => {
    setWidgetState("site1", { isOpen: true, scrollTop: 150 });
    const state = getWidgetState("site1");
    expect(state).toEqual({ isOpen: true, scrollTop: 150 });
  });

  it("returns null when no state stored", () => {
    expect(getWidgetState("site1")).toBeNull();
  });
});
