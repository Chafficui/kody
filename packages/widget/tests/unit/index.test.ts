import { describe, it, expect, beforeEach, vi } from "vitest";

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
    expect(window.KodyConfig.branding?.name).toBe("HelpBot");
    expect(window.KodyConfig.branding?.position).toBe("bottom-left");
  });
});
