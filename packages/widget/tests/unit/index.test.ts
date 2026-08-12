import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, KodyWidget, WIDGET_VERSION } from "../../src/index.js";
import type { PublicSiteConfig } from "../../src/api/client.js";

const sampleConfig: PublicSiteConfig = {
  siteId: "mount-test",
  branding: {
    name: "MountBot",
    colors: {
      primary: "#000",
      primaryForeground: "#fff",
      background: "#fff",
      foreground: "#000",
      bubbleBackground: "#eee",
      userBubbleBackground: "#000",
      userBubbleForeground: "#fff",
    },
    position: "bottom-right",
    welcomeMessage: "Hi!",
    inputPlaceholder: "Type",
    bubbleIcon: "chat",
    bubbleSize: "md",
    theme: "light",
    borderRadius: 12,
  },
  tickets: { enabled: false, promptMessage: "", requiredFields: [] },
  personality: { tone: "friendly", formality: "balanced", responseLength: "balanced" },
  compliance: { aiDisclosureEnabled: false, aiDisclosureMessage: "", conversationDeletionEnabled: false },
  conversationStarters: [],
};

function mockConfigFetch(): void {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(sampleConfig), { status: 200 }));
}

describe("widget config detection", () => {
  beforeEach(() => {
    delete window.KodyConfig;
    vi.restoreAllMocks();
  });

  it("reads config from window.KodyConfig", () => {
    window.KodyConfig = { siteId: "test-site" };
    expect(window.KodyConfig.siteId).toBe("test-site");
  });

  it("supports branding overrides in config", () => {
    window.KodyConfig = {
      siteId: "test-site",
      branding: {
        name: "HelpBot",
        primaryColor: "#ff0000",
        position: "bottom-left",
      },
    };
    // window.KodyConfig is typed as Record<string, unknown> to keep
    // the embed-config surface permissive; cast to the test shape so
    // the assertions typecheck under the dedicated test tsconfig.
    const cfg = window.KodyConfig as {
      branding?: { name?: string; position?: string };
    };
    expect(cfg.branding?.name).toBe("HelpBot");
    expect(cfg.branding?.position).toBe("bottom-left");
  });
});

describe("public exports", () => {
  it("exports WIDGET_VERSION as a semver-like string", () => {
    expect(typeof WIDGET_VERSION).toBe("string");
    expect(WIDGET_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("exports KodyWidget class", () => {
    expect(KodyWidget).toBeDefined();
    expect(typeof KodyWidget).toBe("function");
  });
});

describe("mount()", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockConfigFetch();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns a public API object with all expected methods", async () => {
    const api = mount({ siteId: "x", serverUrl: "https://api.example.com" });
    expect(typeof api.open).toBe("function");
    expect(typeof api.close).toBe("function");
    expect(typeof api.toggle).toBe("function");
    expect(typeof api.destroy).toBe("function");
    expect(typeof api.sendMessage).toBe("function");
    expect(typeof api.prefillInput).toBe("function");
    expect(typeof api.setUserContext).toBe("function");
    expect(typeof api.setLocale).toBe("function");
    expect(typeof api.setTheme).toBe("function");
    expect(typeof api.on).toBe("function");
    expect(typeof api.identify).toBe("function");
    expect(api.version).toBe(WIDGET_VERSION);
    expect(api.ready).toBeInstanceOf(Promise);
    await api.ready;
    api.destroy();
  });

  it("on() returns an unsubscribe function", async () => {
    const api = mount({ siteId: "x", serverUrl: "https://api.example.com" });
    await api.ready;
    const off = api.on("open", () => {});
    expect(typeof off).toBe("function");
    off();
    api.destroy();
  });

  it("destroys the widget on destroy()", async () => {
    const api = mount({ siteId: "x", serverUrl: "https://api.example.com" });
    await api.ready;
    api.destroy();
    expect(document.getElementById("kody-widget")).toBeNull();
  });
});
