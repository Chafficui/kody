import { describe, it, expect } from "vitest";
import { parseEmbedConfig, type DataAttributeMap } from "../../../src/utils/embed-config.js";

function ds(overrides: Partial<DataAttributeMap> = {}): DataAttributeMap {
  return { ...overrides };
}

describe("parseEmbedConfig", () => {
  it("requires siteId", () => {
    expect(() => parseEmbedConfig(ds(), null)).toThrow(/siteId/);
  });

  it("reads siteId from data-* when window has nothing", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "abc" }), null);
    expect(cfg.siteId).toBe("abc");
  });

  it("window config wins on conflict", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "data-site" }), { siteId: "win-site" });
    expect(cfg.siteId).toBe("win-site");
  });

  it("parses data-open-on-load as boolean", () => {
    const on = parseEmbedConfig(ds({ siteId: "a", openOnLoad: "true" }), null);
    expect(on.openOnLoad).toBe(true);
    const off = parseEmbedConfig(ds({ siteId: "a", openOnLoad: "false" }), null);
    expect(off.openOnLoad).toBe(false);
  });

  it("parses user-traits JSON and ignores invalid JSON", () => {
    const good = parseEmbedConfig(
      ds({ siteId: "a", userTraits: '{"plan":"pro"}' }),
      null,
    );
    expect(good.userTraits).toEqual({ plan: "pro" });

    const bad = parseEmbedConfig(ds({ siteId: "a", userTraits: "not-json" }), null);
    expect(bad.userTraits).toBeUndefined();
  });

  it("rejects invalid theme values", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "a", theme: "neon" }), null);
    expect(cfg.theme).toBeUndefined();
  });

  it("accepts a valid theme", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "a", theme: "dark" }), null);
    expect(cfg.theme).toBe("dark");
  });

  it("parses data-user-context JSON into a record", () => {
    const cfg = parseEmbedConfig(
      ds({ siteId: "a", userContext: '{"page":"checkout"}' }),
      null,
    );
    expect(cfg.userContext).toEqual({ page: "checkout" });
  });

  it("parses data-prefill-message", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "a", prefillMessage: "Hi!" }), null);
    expect(cfg.prefillMessage).toBe("Hi!");
  });

  it("parses data-locale", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "a", locale: "de" }), null);
    expect(cfg.locale).toBe("de");
  });

  it("parses data-keyboard-shortcut", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "a", keyboardShortcut: "ctrl+/" }), null);
    expect(cfg.keyboardShortcut).toBe("ctrl+/");
  });

  it("falls back to false to disable the keyboard shortcut", () => {
    const cfg = parseEmbedConfig(ds({ siteId: "a", keyboardShortcut: "false" }), null);
    expect(cfg.keyboardShortcut).toBe("false");
  });
});
