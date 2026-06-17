import { KodyWidget, type KodyWidgetConfig } from "./kody.js";

// Capture before IIFE wrapper nullifies it
const _currentScript = document.currentScript as HTMLScriptElement | null;

interface KodyEmbedConfig {
  siteId: string;
  serverUrl?: string;
  branding?: {
    name?: string;
    primaryColor?: string;
    position?: "bottom-right" | "bottom-left";
  };
}

declare global {
  interface Window {
    KodyConfig?: KodyEmbedConfig;
    Kody?: KodyPublicAPI;
  }
}

interface KodyPublicAPI {
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;
  onOpen(callback: () => void): void;
  onClose(callback: () => void): void;
}

function getConfig(): KodyEmbedConfig | null {
  if (window.KodyConfig?.siteId) {
    return window.KodyConfig;
  }

  if (_currentScript?.dataset.siteId) {
    return {
      siteId: _currentScript.dataset.siteId,
      serverUrl: _currentScript.dataset.serverUrl,
    };
  }

  return null;
}

function resolveServerUrl(config: KodyEmbedConfig): string {
  if (config.serverUrl) return config.serverUrl;

  if (_currentScript?.src) {
    try {
      const url = new URL(_currentScript.src);
      return url.origin;
    } catch {
      // fall through
    }
  }

  return window.location.origin;
}

function init(): void {
  const embedConfig = getConfig();
  if (!embedConfig) {
    console.error("[Kody] Missing siteId. Use data-site-id attribute or window.KodyConfig.");
    return;
  }

  const serverUrl = resolveServerUrl(embedConfig);

  const widgetConfig: KodyWidgetConfig = {
    siteId: embedConfig.siteId,
    serverUrl,
    branding: embedConfig.branding,
  };

  const widget = new KodyWidget(widgetConfig);

  window.Kody = {
    open: () => widget.open(),
    close: () => widget.close(),
    toggle: () => widget.toggle(),
    destroy: () => widget.destroy(),
    onOpen: (cb: () => void) => widget.onOpen(cb),
    onClose: (cb: () => void) => widget.onClose(cb),
  };

  widget.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
