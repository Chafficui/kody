import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { KodyWidget } from "../../src/kody.js";
import type { PublicSiteConfig } from "../../src/api/client.js";

const sampleConfig: PublicSiteConfig = {
  siteId: "test-site",
  branding: {
    name: "TestBot",
    colors: {
      primary: "#0066ff",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#1a1a2e",
      bubbleBackground: "#f0f0f0",
      userBubbleBackground: "#0066ff",
      userBubbleForeground: "#ffffff",
    },
    position: "bottom-right",
    welcomeMessage: "Hi!",
    inputPlaceholder: "Type here...",
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

function mockConfigFetch(config: PublicSiteConfig = sampleConfig): void {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(config), { status: 200 }));
}

let widgetInstance: KodyWidget | null = null;

async function makeWidget(overrides: Partial<ConstructorParameters<typeof KodyWidget>[0]> = {}) {
  mockConfigFetch();
  const widget = new KodyWidget({
    siteId: "test-site",
    serverUrl: "https://api.example.com",
    ...overrides,
  });
  // init() is not called from the constructor; the IIFE auto-init path
  // and the ESM `mount()` call it explicitly.
  void widget.init();
  await widget.ready;
  widgetInstance = widget;
  return widget;
}

describe("KodyWidget public API", () => {
  afterEach(() => {
    if (widgetInstance) {
      try { widgetInstance.destroy(); } catch {}
      widgetInstance = null;
    }
    try { sessionStorage.clear(); } catch {}
    try { localStorage.clear(); } catch {}
    document.getElementById("kody-widget")?.remove();
  });

  describe("constructor", () => {
    it("attaches a host element with id kody-widget to the body", () => {
      const widget = new KodyWidget({ siteId: "s", serverUrl: "https://x" });
      const host = document.getElementById("kody-widget");
      expect(host).not.toBeNull();
      widget.destroy();
    });
  });

  describe("ready promise", () => {
    it("resolves once init() has finished", async () => {
      const widget = await makeWidget();
      // After await, ready should already be resolved.
      const after = await Promise.race([
        widget.ready.then(() => "resolved" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
      ]);
      expect(after).toBe("resolved");
    });
  });

  describe("identify", () => {
    it("sends x-kody-user-id on every chat request", async () => {
      const widget = await makeWidget({ userId: "u-1", userTraits: { plan: "pro" } });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(`data: ${JSON.stringify({ type: "done" })}\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
      globalThis.fetch = fetchMock;

      await widget.sendMessage("hello");
      // fetchConfig is one call, sendMessage is another
      const chatCall = fetchMock.mock.calls.find((c) => (c[0] as string).includes("/api/chat"));
      expect(chatCall).toBeDefined();
      const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-kody-user-id"]).toBe("u-1");
      expect(headers["x-kody-user-traits"]).toBe(JSON.stringify({ plan: "pro" }));
    });

    it("omits identity headers after identify(undefined)", async () => {
      // The docs promise that passing undefined clears the user id.
      // Before the fix, the call was rejected at the type level AND a
      // JS caller would still store an identity object (with
      // userId === undefined) that buildMessageHeaders() would treat
      // as a truthy identity and emit the header anyway. We use a
      // fresh widget to avoid the in-flight sendMessage guard
      // (mirroring the setUserContext "removes the header" test).
      const widget = await makeWidget();
      widget.identify(undefined);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(`data: ${JSON.stringify({ type: "done" })}\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
      globalThis.fetch = fetchMock;

      await widget.sendMessage("hello");
      const chatCall = fetchMock.mock.calls.find((c) => (c[0] as string).includes("/api/chat"));
      expect(chatCall).toBeDefined();
      const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
      // Site id is still public; identity headers must be absent.
      expect(headers["x-kody-site-id"]).toBe("test-site");
      expect(headers["x-kody-user-id"]).toBeUndefined();
      expect(headers["x-kody-user-traits"]).toBeUndefined();
    });

    it("accepts undefined as the userId (TypeScript contract)", () => {
      // Compile-time check: this must typecheck with the relaxed
      // signature. If someone reverts the parameter back to `string`,
      // this line will fail to build.
      const widget = new KodyWidget({ siteId: "s", serverUrl: "https://x" });
      widget.identify(undefined);
      widget.destroy();
    });
  });

  describe("setUserContext", () => {
    it("attaches x-kody-user-context to subsequent requests", async () => {
      const widget = await makeWidget();
      widget.setUserContext({ page: "checkout", cart: 3 });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(`data: ${JSON.stringify({ type: "done" })}\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
      globalThis.fetch = fetchMock;
      await widget.sendMessage("hi");
      const chatCall = fetchMock.mock.calls.find((c) => (c[0] as string).includes("/api/chat"));
      const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-kody-user-context"]).toBe(JSON.stringify({ page: "checkout", cart: 3 }));
    });

    it("removes the header when set to undefined", async () => {
      const widget = await makeWidget({ userContext: { foo: "bar" } });
      widget.setUserContext(undefined);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(`data: ${JSON.stringify({ type: "done" })}\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
      globalThis.fetch = fetchMock;
      await widget.sendMessage("hi");
      const chatCall = fetchMock.mock.calls.find((c) => (c[0] as string).includes("/api/chat"));
      const headers = (chatCall![1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-kody-user-context"]).toBeUndefined();
    });
  });

  describe("sendMessage", () => {
    it("throws when given a non-string", async () => {
      const widget = await makeWidget();
      // @ts-expect-error testing runtime guard
      await expect(widget.sendMessage(null)).rejects.toThrow(/string/);
      // @ts-expect-error testing runtime guard
      await expect(widget.sendMessage("")).rejects.toThrow(/empty/);
    });

    it("emits a 'message' event with the user role", async () => {
      const widget = await makeWidget();
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(`data: ${JSON.stringify({ type: "done" })}\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
      globalThis.fetch = fetchMock;

      const onMessage = vi.fn();
      widget.on("message", onMessage);
      await widget.sendMessage("hi there");
      // Allow microtask queue to drain (sendMessage's event emit is sync)
      await new Promise((r) => setTimeout(r, 0));
      const userCall = onMessage.mock.calls.find((c) => c[0].role === "user");
      expect(userCall).toBeDefined();
      expect(userCall![0].content).toBe("hi there");
    });
  });

  describe("on / off", () => {
    it("on() returns an unsubscribe function", async () => {
      const widget = await makeWidget();
      const cb = vi.fn();
      const off = widget.on("error", cb);
      expect(typeof off).toBe("function");
      off();
      // destroy emits nothing; just verify off() removed the listener
    });
  });

  describe("setTheme", () => {
    it("updates the data-theme attribute on the host", async () => {
      const widget = await makeWidget();
      widget.setTheme("dark");
      expect(widget["host"].getAttribute("data-theme")).toBe("dark");
    });
  });

  describe("destroy", () => {
    it("removes the host element", async () => {
      const widget = await makeWidget();
      widget.destroy();
      expect(document.getElementById("kody-widget")).toBeNull();
    });

    it("open() becomes a no-op after destroy()", async () => {
      const widget = await makeWidget();
      widget.destroy();
      // Destroyed widgets must not re-open or install new listeners
      // (e.g. focus trap, transitionend handler) on a detached host.
      widget.open();
      expect(widget["isOpen"]).toBe(false);
    });

    it("setTheme() becomes a no-op after destroy()", async () => {
      const widget = await makeWidget();
      widget.setTheme("dark");
      widget.destroy();
      // Calling setTheme on a destroyed widget should not throw and
      // should not rebind a dark-mode listener on a detached host.
      expect(() => widget.setTheme("auto")).not.toThrow();
      expect(widget["darkModeQuery"]).toBeNull();
    });

    it("sendMessage() rejects with a destruction-specific error after destroy()", async () => {
      const widget = await makeWidget();
      widget.destroy();
      await expect(widget.sendMessage("hi")).rejects.toThrow(/destroyed/i);
    });
  });
});
