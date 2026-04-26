/** Main chat window container. */

import { el, text, on } from "../utils/dom.js";
import { sanitizeText } from "../utils/sanitize.js";

export interface ChatWindowOptions {
  name: string;
  tagline?: string;
  position: "bottom-right" | "bottom-left";
  onClose: () => void;
  onSend: (message: string) => void;
}

export interface ChatWindow {
  element: HTMLDivElement;
  messagesContainer: HTMLDivElement;
  inputBar: { input: HTMLTextAreaElement; sendBtn: HTMLButtonElement };
  setOpen(open: boolean): void;
  setLoading(loading: boolean): void;
  scrollToBottom(): void;
}

function createCloseSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M18 6L6 18M6 6l12 12");
  svg.appendChild(path);

  return svg;
}

function createSendSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "12");
  line.setAttribute("y1", "19");
  line.setAttribute("x2", "12");
  line.setAttribute("y2", "5");
  svg.appendChild(line);

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", "5 12 12 5 19 12");
  svg.appendChild(polyline);

  return svg;
}

/**
 * Create the main chat window.
 */
export function createChatWindow(options: ChatWindowOptions): ChatWindow {
  const { name, tagline, position, onClose, onSend } = options;

  // ── Header ───────────────────────────────────────────────────────────────
  const titleEl = el("span", { class: "kody-header-name" }, [name]);

  const headerContent: Node[] = [titleEl];
  if (tagline) {
    headerContent.push(el("span", { class: "kody-header-tagline" }, [tagline]));
  }

  const headerInfo = el("div", { class: "kody-header-info" }, headerContent);

  const closeBtn = el("button", {
    class: "kody-close-btn",
    "aria-label": "Close chat",
  });
  closeBtn.appendChild(createCloseSvg());
  on(closeBtn, "click", () => onClose());

  const header = el("div", { class: "kody-header" }, [headerInfo, closeBtn]);

  // ── Messages container ───────────────────────────────────────────────────
  const messagesContainer = el("div", { class: "kody-messages" });

  // ── Input bar ────────────────────────────────────────────────────────────
  const input = document.createElement("textarea");
  input.className = "kody-input";
  input.placeholder = "Type a message...";
  input.rows = 1;
  input.cols = 1;
  input.wrap = "soft";
  input.autocomplete = "off";

  function autoResize(): void {
    input.style.height = "auto";
    const maxHeight = 120;
    input.style.height = Math.min(input.scrollHeight, maxHeight) + "px";
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  on(input, "input", autoResize);

  const sendBtn = el("button", {
    class: "kody-send-btn",
    "aria-label": "Send message",
  });
  sendBtn.appendChild(createSendSvg());

  const inputRow = el("div", { class: "kody-input-row" }, [input, sendBtn]);
  const inputBar = el("div", { class: "kody-input-bar" }, [inputRow]);

  function doSend(): void {
    const raw = input.value;
    const message = sanitizeText(raw);
    if (message.length === 0) return;
    input.value = "";
    input.style.height = "auto";
    onSend(message);
  }

  on(input, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  on(sendBtn, "click", () => doSend());

  // ── Assemble window ──────────────────────────────────────────────────────
  const windowEl = el("div", { class: "kody-window" }, [header, messagesContainer, inputBar]);

  if (position === "bottom-left") {
    windowEl.setAttribute("data-position", "left");
  }

  // ── Public interface ─────────────────────────────────────────────────────
  return {
    element: windowEl,
    messagesContainer,
    inputBar: { input, sendBtn },

    setOpen(open: boolean): void {
      if (open) {
        windowEl.classList.add("kody-window--open");
      } else {
        windowEl.classList.remove("kody-window--open");
      }
    },

    setLoading(loading: boolean): void {
      input.disabled = loading;
      sendBtn.disabled = loading;
    },

    scrollToBottom(): void {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
  };
}
