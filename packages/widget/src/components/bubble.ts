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

export type BubbleIconType = "chat" | "headset" | "robot" | "custom";
export type BubbleSizeType = "sm" | "md" | "lg";

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

function createHeadsetIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 18v-6a9 9 0 0 1 18 0v6");
  svg.appendChild(path);

  const leftCup = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  leftCup.setAttribute("x", "1");
  leftCup.setAttribute("y", "14");
  leftCup.setAttribute("width", "4");
  leftCup.setAttribute("height", "6");
  leftCup.setAttribute("rx", "1");
  svg.appendChild(leftCup);

  const rightCup = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rightCup.setAttribute("x", "19");
  rightCup.setAttribute("y", "14");
  rightCup.setAttribute("width", "4");
  rightCup.setAttribute("height", "6");
  rightCup.setAttribute("rx", "1");
  svg.appendChild(rightCup);

  return svg;
}

function createRobotIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const body = document.createElementNS("http://www.w3.org/2000/svg", "path");
  body.setAttribute("d", "M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2z");
  svg.appendChild(body);

  const leftEye = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  leftEye.setAttribute("cx", "9");
  leftEye.setAttribute("cy", "11");
  leftEye.setAttribute("r", "1");
  svg.appendChild(leftEye);

  const rightEye = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  rightEye.setAttribute("cx", "15");
  rightEye.setAttribute("cy", "11");
  rightEye.setAttribute("r", "1");
  svg.appendChild(rightEye);

  return svg;
}

function createBubbleIconElement(icon: BubbleIconType, iconUrl?: string): SVGSVGElement | HTMLImageElement {
  switch (icon) {
    case "headset":
      return createHeadsetIcon();
    case "robot":
      return createRobotIcon();
    case "custom": {
      if (iconUrl) {
        const img = document.createElement("img");
        img.src = iconUrl;
        img.alt = "";
        return img;
      }
      return createSvgIcon(CHAT_ICON_PATH, false);
    }
    case "chat":
    default:
      return createSvgIcon(CHAT_ICON_PATH, false);
  }
}

let currentIcon: BubbleIconType = "chat";
let currentIconUrl: string | undefined;

export function createBubble(
  position: "bottom-right" | "bottom-left",
  callbacks: BubbleCallbacks,
  options?: { icon?: BubbleIconType; iconUrl?: string; size?: BubbleSizeType },
): HTMLButtonElement {
  const icon = options?.icon ?? "chat";
  const size = options?.size ?? "md";
  currentIcon = icon;
  currentIconUrl = options?.iconUrl;

  const button = el("button", {
    class: "kody-bubble",
    "aria-label": "Open chat",
    "data-size": size,
  });

  if (position === "bottom-left") {
    button.setAttribute("data-position", "left");
  }

  button.appendChild(createBubbleIconElement(icon, options?.iconUrl));
  on(button, "click", () => callbacks.onToggle());

  return button;
}

export function setBubbleIcon(bubble: HTMLButtonElement, isOpen: boolean): void {
  const badge = bubble.querySelector(".kody-badge");
  while (bubble.firstChild) {
    bubble.removeChild(bubble.firstChild);
  }

  if (isOpen) {
    bubble.appendChild(createSvgIcon(CLOSE_ICON_PATH, true));
    bubble.setAttribute("aria-label", "Close chat");
  } else {
    bubble.appendChild(createBubbleIconElement(currentIcon, currentIconUrl));
    bubble.setAttribute("aria-label", "Open chat");
  }

  if (badge) {
    bubble.appendChild(badge);
  }
}

export function setBubbleBadge(bubble: HTMLButtonElement, count: number): void {
  let badge = bubble.querySelector(".kody-badge") as HTMLSpanElement | null;

  if (count <= 0) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = el("span", { class: "kody-badge" }) as HTMLSpanElement;
    bubble.appendChild(badge);
  }

  badge.textContent = count > 99 ? "99+" : String(count);
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
