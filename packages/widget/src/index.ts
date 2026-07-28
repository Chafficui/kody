/**
 * Public entry point for the widget. Vite bundles this file to
 * produce kody.js (IIFE), kody.esm.js, and kody.umd.js. The bundle
 * also re-exports the public API so ESM consumers can do
 *
 *   import { mount, KodyWidget, WIDGET_VERSION } from "@kody/widget";
 */

import { KodyWidget, buildPublicAPI, type KodyWidgetConfig, type KodyPublicAPI } from "./kody.js";
import { parseEmbedConfig } from "./utils/embed-config.js";
import { resolveStrings } from "./i18n/en.js";

export {
  KodyWidget,
  buildPublicAPI,
  WIDGET_VERSION,
  type KodyWidgetConfig,
  type KodyPublicAPI,
} from "./kody.js";

// Capture before IIFE wrapper nullifies `document.currentScript`.
const _currentScript = (typeof document !== "undefined"
  ? (document.currentScript as HTMLScriptElement | null)
  : null) as HTMLScriptElement | null;

declare global {
  interface Window {
    KodyConfig?: Record<string, unknown>;
    Kody?: KodyPublicAPI;
  }
}

function resolveServerUrl(config: { serverUrl?: string }): string {
  if (config.serverUrl) return config.serverUrl;
  if (_currentScript?.src) {
    try {
      return new URL(_currentScript.src).origin;
    } catch {
      // fall through
    }
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function buildConfigFromScript(): Record<string, unknown> | null {
  if (typeof document === "undefined" || !_currentScript) return null;
  const dataset = _currentScript.dataset ?? {};
  if (!dataset.siteId) return null;
  return {
    siteId: dataset.siteId,
    serverUrl: dataset.serverUrl,
    branding: {
      name: dataset.name,
      position: dataset.position,
      primaryColor: dataset.primaryColor,
    },
    locale: dataset.locale,
    openOnLoad: dataset.openOnLoad,
    prefillMessage: dataset.prefillMessage,
    userId: dataset.userId,
    userTraits: dataset.userTraits ? safeJsonParse(dataset.userTraits) : undefined,
    theme: dataset.theme,
    userContext: dataset.userContext ? safeJsonParse(dataset.userContext) : undefined,
    keyboardShortcut: dataset.keyboardShortcut,
  };
}

function safeJsonParse(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    console.warn("[Kody] invalid JSON in data-* attribute, ignoring");
    return undefined;
  }
}

function readMountConfig(): KodyWidgetConfig | null {
  // Merge precedence: data-* (lowest) → window.KodyConfig (highest).
  const fromScript = buildConfigFromScript() ?? {};
  const fromWindow: Record<string, unknown> = {};
  if (typeof window !== "undefined" && window.KodyConfig) {
    Object.assign(fromWindow, window.KodyConfig);
  }

  const merged: Record<string, unknown> = { ...fromScript, ...fromWindow };
  if (!merged.siteId) return null;

  const validated = parseEmbedConfig(
    (_currentScript?.dataset ?? {}) as Record<string, string | undefined>,
    merged,
  );

  const serverUrl = resolveServerUrl({
    serverUrl: typeof validated.serverUrl === "string" ? validated.serverUrl : undefined,
  });

  return {
    siteId: validated.siteId,
    serverUrl,
    branding: validated.branding,
    locale: validated.locale,
    openOnLoad: validated.openOnLoad,
    prefillMessage: validated.prefillMessage,
    userId: validated.userId,
    userTraits: validated.userTraits ?? undefined,
    theme: validated.theme,
    userContext: validated.userContext ?? undefined,
    keyboardShortcut: validated.keyboardShortcut,
  };
}

/**
 * Public mount function for ESM consumers.
 *
 *   import { mount } from "@kody/widget";
 *   const api = mount({ siteId: "...", serverUrl: "..." });
 *   api.on("open", () => console.log("opened"));
 */
export function mount(config: KodyWidgetConfig): KodyPublicAPI {
  const widget = new KodyWidget(config);
  const api = buildPublicAPI(widget);
  void widget.init();
  return api;
}

function autoInit(): void {
  const config = readMountConfig();
  if (!config) {
    console.error("[Kody] Missing siteId. Use data-site-id attribute or window.KodyConfig.");
    return;
  }
  const widget = new KodyWidget(config);
  void resolveStrings(config.locale);
  if (typeof window !== "undefined") {
    window.Kody = buildPublicAPI(widget);
  }
  void widget.init();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
}
