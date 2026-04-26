import { KodyWidget, type KodyWidgetConfig } from "./kody.js";

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
  destroy(): void;
}

function getConfig(): KodyEmbedConfig | null {
  if (window.KodyConfig?.siteId) {
    return window.KodyConfig;
  }

  const script = document.currentScript as HTMLScriptElement | null;
  if (script?.dataset.siteId) {
    return {
      siteId: script.dataset.siteId,
      serverUrl: script.dataset.serverUrl,
    };
  }

  return null;
}

function resolveServerUrl(config: KodyEmbedConfig): string {
  if (config.serverUrl) return config.serverUrl;

  const script = document.currentScript as HTMLScriptElement | null;
  if (script?.src) {
    try {
      const url = new URL(script.src);
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
    destroy: () => widget.destroy(),
  };

  widget.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
