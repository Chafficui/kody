import { describe, it, expect } from "vitest";
import { isTrustedServerUrl } from "../../../src/utils/url.js";

describe("isTrustedServerUrl", () => {
  it("accepts https:// origins", () => {
    expect(isTrustedServerUrl("https://api.example.com")).toBe(true);
    expect(isTrustedServerUrl("https://api.example.com:8443/chat")).toBe(true);
  });

  it("accepts http://localhost as a loopback dev exception", () => {
    expect(isTrustedServerUrl("http://localhost")).toBe(true);
    expect(isTrustedServerUrl("http://localhost:3000")).toBe(true);
    expect(isTrustedServerUrl("http://localhost/api")).toBe(true);
  });

  it("accepts http://127.0.0.1 as a loopback dev exception", () => {
    expect(isTrustedServerUrl("http://127.0.0.1")).toBe(true);
    expect(isTrustedServerUrl("http://127.0.0.1:8080")).toBe(true);
  });

  it("accepts http://[::1] as a loopback dev exception", () => {
    expect(isTrustedServerUrl("http://[::1]")).toBe(true);
    expect(isTrustedServerUrl("http://[::1]:8080")).toBe(true);
  });

  it("rejects plain-http origins that are not loopback", () => {
    expect(isTrustedServerUrl("http://api.example.com")).toBe(false);
    expect(isTrustedServerUrl("http://192.168.1.10")).toBe(false);
  });

  it("rejects unrelated protocols", () => {
    expect(isTrustedServerUrl("ftp://api.example.com")).toBe(false);
    expect(isTrustedServerUrl("ws://api.example.com")).toBe(false);
  });

  it("rejects unparseable strings", () => {
    expect(isTrustedServerUrl("not a url")).toBe(false);
    expect(isTrustedServerUrl("")).toBe(false);
  });
});
