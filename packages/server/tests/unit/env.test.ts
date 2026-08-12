import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEnv } from "../../src/env.js";

describe("loadEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns defaults when no env vars are set", () => {
    delete process.env.NODE_ENV;
    const env = loadEnv();
    expect(env.PORT).toBe(3456);
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_PATH).toBe("./kody.db");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("parses PORT as number", () => {
    process.env.PORT = "8080";
    const env = loadEnv();
    expect(env.PORT).toBe(8080);
  });

  it("accepts production NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    const env = loadEnv();
    expect(env.NODE_ENV).toBe("production");
  });

  it("accepts test NODE_ENV", () => {
    process.env.NODE_ENV = "test";
    const env = loadEnv();
    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects invalid NODE_ENV", () => {
    process.env.NODE_ENV = "staging";
    expect(() => loadEnv()).toThrow();
  });

  it("parses optional ADMIN_EMAIL", () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "securepassword123";
    const env = loadEnv();
    expect(env.ADMIN_EMAIL).toBe("admin@example.com");
    expect(env.ADMIN_PASSWORD).toBe("securepassword123");
  });

  it("rejects invalid ADMIN_EMAIL", () => {
    process.env.ADMIN_EMAIL = "not-an-email";
    expect(() => loadEnv()).toThrow();
  });

  it("rejects ADMIN_PASSWORD shorter than 8 chars", () => {
    process.env.ADMIN_PASSWORD = "short";
    expect(() => loadEnv()).toThrow();
  });

  describe("PUBLIC_ORIGIN", () => {
    it("is undefined when unset", () => {
      delete process.env.PUBLIC_ORIGIN;
      const env = loadEnv();
      expect(env.PUBLIC_ORIGIN).toBeUndefined();
    });

    it("is undefined when set to an empty string", () => {
      process.env.PUBLIC_ORIGIN = "";
      const env = loadEnv();
      expect(env.PUBLIC_ORIGIN).toBeUndefined();
    });

    it("parses a single origin as a one-element array", () => {
      process.env.PUBLIC_ORIGIN = "https://kody.example.com";
      const env = loadEnv();
      expect(env.PUBLIC_ORIGIN).toEqual(["https://kody.example.com"]);
    });

    it("splits comma-separated origins and trims whitespace", () => {
      process.env.PUBLIC_ORIGIN = "https://a.example.com, https://b.example.com";
      const env = loadEnv();
      expect(env.PUBLIC_ORIGIN).toEqual([
        "https://a.example.com",
        "https://b.example.com",
      ]);
    });

    it("drops empty entries from trailing or doubled commas", () => {
      process.env.PUBLIC_ORIGIN = "https://a.example.com,,,https://b.example.com,";
      const env = loadEnv();
      expect(env.PUBLIC_ORIGIN).toEqual([
        "https://a.example.com",
        "https://b.example.com",
      ]);
    });

    it("dedupes repeated origins", () => {
      process.env.PUBLIC_ORIGIN = "https://a.example.com,https://a.example.com";
      const env = loadEnv();
      expect(env.PUBLIC_ORIGIN).toEqual(["https://a.example.com"]);
    });

    it("rejects scheme-less values", () => {
      process.env.PUBLIC_ORIGIN = "kody.example.com";
      expect(() => loadEnv()).toThrow(/valid URL/);
    });

    it("rejects non-http(s) schemes", () => {
      process.env.PUBLIC_ORIGIN = "javascript:alert(1)";
      expect(() => loadEnv()).toThrow(/http\(s\) URL/);
    });

    it("rejects when any comma-separated entry is invalid", () => {
      process.env.PUBLIC_ORIGIN = "https://a.example.com,not-a-url";
      expect(() => loadEnv()).toThrow(/valid URL/);
    });

    it("normalizes each origin to its URL.origin (drops path/query)", () => {
      process.env.PUBLIC_ORIGIN = "https://a.example.com/some/path?x=1";
      const env = loadEnv();
      expect(env.PUBLIC_ORIGIN).toEqual(["https://a.example.com"]);
    });
  });
});
