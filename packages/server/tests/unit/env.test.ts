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
});
