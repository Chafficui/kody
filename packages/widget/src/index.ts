/**
 * Public entry point for the widget. Vite bundles this file to
 * produce kody.js (IIFE), kody.esm.js, and kody.umd.js. The bundle
 * also re-exports the public API so ESM consumers can do
 *
 *   import { mount, KodyWidget, WIDGET_VERSION } from "@kody/widget";
 */

import { KodyWidget, buildPublicAPI, type KodyWidgetConfig, type KodyPublicAPI } from "./kody.js";
import { parseEmbedConfig } from "./utils/embed-config.js";
import { isTrustedServerUrl } from "./utils/url.js";
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

function resolveServerUrl(serverUrl: string | undefined): string {
  if (serverUrl) return serverUrl;
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

function readMountConfig(): KodyWidgetConfig | null {
  // Hand the raw dataset and window.KodyConfig straight to parseEmbedConfig —
  // it already merges (window wins), parses JSON-encoded data-* values, and
  // normalises the result. No need to duplicate the merge or the JSON
  // parsing here.
  const dataset = (_currentScript?.dataset ?? {}) as Record<string, string | undefined>;
  const windowConfig = typeof window !== "undefined" ? window.KodyConfig ?? null : null;

  let validated;
  try {
    validated = parseEmbedConfig(dataset, windowConfig);
  } catch (err) {
    console.error("[Kody] invalid embed config:", (err as Error).message);
    return null;
  }

  const serverUrl = resolveServerUrl(validated.serverUrl);

  // Refuse to forward identity / context data to a non-trusted
  // origin. The IIFE auto-init path bails out so the widget does
  // not mount on a plain-HTTP page (or any other untrusted origin
  // the script tag was tricked into pointing at). Local development
  // via http://localhost remains a supported exception.
  if (!isTrustedServerUrl(serverUrl)) {
    console.error(
      `[Kody] Refusing to mount: serverUrl "${serverUrl}" is not HTTPS or a loopback host. ` +
        `Use https:// or http://localhost / http://127.0.0.1 for local dev.`,
    );
    return null;
  }

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
