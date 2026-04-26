import { describe, it, expect, beforeEach } from "vitest";
import {
  getSessionId,
  setSessionId,
  clearSession,
  generateSessionId,
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
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
