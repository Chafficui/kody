/** Floating chat bubble button with attention animations. */

import { el, on } from "../utils/dom.js";

export interface BubbleCallbacks {
  onToggle: () => void;
}

export interface AttentionConfig {
  enabled: boolean;
  message?: string;
  delayMs?: number;
  intervalMs?: number;
}

const CHAT_ICON_PATH =
  "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z";

const CLOSE_ICON_PATH = "M18 6L6 18M6 6l12 12";

function createSvgIcon(path: string, isStroke: boolean): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", isStroke ? "none" : "currentColor");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.setAttribute("d", path);
  svg.appendChild(pathEl);

  return svg;
}

export function createBubble(
  position: "bottom-right" | "bottom-left",
  callbacks: BubbleCallbacks,
): HTMLButtonElement {
  const button = el("button", {
    class: "kody-bubble",
    "aria-label": "Open chat",
  });

  if (position === "bottom-left") {
    button.setAttribute("data-position", "left");
  }

  button.appendChild(createSvgIcon(CHAT_ICON_PATH, false));
  on(button, "click", () => callbacks.onToggle());

  return button;
}

export function setBubbleIcon(bubble: HTMLButtonElement, isOpen: boolean): void {
  while (bubble.firstChild) {
    bubble.removeChild(bubble.firstChild);
  }

  if (isOpen) {
    bubble.appendChild(createSvgIcon(CLOSE_ICON_PATH, true));
    bubble.setAttribute("aria-label", "Close chat");
  } else {
    bubble.appendChild(createSvgIcon(CHAT_ICON_PATH, false));
    bubble.setAttribute("aria-label", "Open chat");
  }
}

export function startBubbleAttention(
  bubble: HTMLButtonElement,
  shadow: ShadowRoot,
  config: AttentionConfig,
): () => void {
  if (!config.enabled) return () => {};

  const delay = config.delayMs ?? 5000;
  const interval = config.intervalMs ?? 8000;
  const message = config.message ?? "Need help? 👋";

  let tooltip: HTMLDivElement | null = null;
  let wiggleTimer: ReturnType<typeof setInterval> | null = null;
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function wiggle(): void {
    if (stopped) return;
    bubble.classList.add("kody-bubble--wiggle");
    setTimeout(() => bubble.classList.remove("kody-bubble--wiggle"), 1000);
  }

  function showTooltip(): void {
    if (stopped || tooltip) return;
    tooltip = el("div", { class: "kody-tooltip" }, [message]) as HTMLDivElement;

    if (bubble.dataset.position === "left") {
      tooltip.classList.add("kody-tooltip--left");
    }

    const dismiss = el("button", { class: "kody-tooltip-close", "aria-label": "Dismiss" }, ["×"]);
    on(dismiss, "click", (e: Event) => {
      e.stopPropagation();
      hideTooltip();
      stop();
    });
    tooltip.appendChild(dismiss);

    shadow.appendChild(tooltip);
    requestAnimationFrame(() => {
      if (tooltip) tooltip.classList.add("kody-tooltip--visible");
    });

    setTimeout(() => hideTooltip(), 6000);
  }

  function hideTooltip(): void {
    if (!tooltip) return;
    tooltip.classList.remove("kody-tooltip--visible");
    const t = tooltip;
    setTimeout(() => t.remove(), 200);
    tooltip = null;
  }

  function stop(): void {
    stopped = true;
    if (wiggleTimer) clearInterval(wiggleTimer);
    if (tooltipTimer) clearTimeout(tooltipTimer);
    hideTooltip();
    bubble.classList.remove("kody-bubble--wiggle");
  }

  tooltipTimer = setTimeout(() => {
    showTooltip();
    wiggleTimer = setInterval(() => {
      wiggle();
      setTimeout(() => showTooltip(), 600);
    }, interval);
  }, delay);

  on(bubble, "click", stop);

  return stop;
}
