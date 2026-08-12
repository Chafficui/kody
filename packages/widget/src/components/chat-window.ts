/** Main chat window container. */

import { el, text, on } from "../utils/dom.js";
import { sanitizeText } from "../utils/sanitize.js";
import type { WidgetStrings } from "../i18n/en.js";

export interface ChatWindowOptions {
  name: string;
  tagline?: string;
  position: "bottom-right" | "bottom-left";
  onClose: () => void;
  onSend: (message: string) => void;
  onNewChat: () => void;
  onDeleteChat?: () => void;
  onToggleSidebar?: () => void;
  strings: WidgetStrings;
}

export interface ChatWindow {
  element: HTMLDivElement;
  messagesContainer: HTMLDivElement;
  inputBar: { input: HTMLTextAreaElement; sendBtn: HTMLButtonElement };
  setOpen(open: boolean): void;
  setLoading(loading: boolean): void;
  scrollToBottom(): void;
  setPrefill(text: string): void;
}

function createNewChatSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z");
  svg.appendChild(path);

  return svg;
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

function createMenuSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", "3"); line1.setAttribute("y1", "6");
  line1.setAttribute("x2", "21"); line1.setAttribute("y2", "6");
  svg.appendChild(line1);

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", "3"); line2.setAttribute("y1", "12");
  line2.setAttribute("x2", "21"); line2.setAttribute("y2", "12");
  svg.appendChild(line2);

  const line3 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line3.setAttribute("x1", "3"); line3.setAttribute("y1", "18");
  line3.setAttribute("x2", "21"); line3.setAttribute("y2", "18");
  svg.appendChild(line3);

  return svg;
}

/**
 * Create the main chat window.
 */
export function createChatWindow(options: ChatWindowOptions): ChatWindow {
  const { name, tagline, position, onClose, onSend, onNewChat, onDeleteChat, onToggleSidebar, strings } = options;

  // ── Header ───────────────────────────────────────────────────────────────
  const titleEl = el("span", { class: "kody-header-name" }, [name]);

  const headerContent: Node[] = [titleEl];
  if (tagline) {
    headerContent.push(el("span", { class: "kody-header-tagline" }, [tagline]));
  }

  const headerInfo = el("div", { class: "kody-header-info" }, headerContent);

  const newChatBtn = el("button", {
    class: "kody-header-btn",
    "aria-label": strings.header.newChat,
    title: strings.header.newChat,
  });
  newChatBtn.appendChild(createNewChatSvg());
  on(newChatBtn, "click", () => onNewChat());

  const closeBtn = el("button", {
    class: "kody-header-btn",
    "aria-label": strings.header.closeChat,
  });
  closeBtn.appendChild(createCloseSvg());
  on(closeBtn, "click", () => onClose());

  const actionBtns: Node[] = [];
  if (onToggleSidebar) {
    const sidebarBtn = el("button", {
      class: "kody-header-btn",
      "aria-label": strings.header.conversations,
      title: strings.header.conversations,
    });
    sidebarBtn.appendChild(createMenuSvg());
    on(sidebarBtn, "click", () => onToggleSidebar());
    actionBtns.push(sidebarBtn);
  }
  actionBtns.push(newChatBtn);
  if (onDeleteChat) {
    const deleteBtn = el("button", {
      class: "kody-header-btn",
      "aria-label": strings.header.deleteConversation,
      title: strings.header.deleteConversation,
    });
    const deleteSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    deleteSvg.setAttribute("width", "16");
    deleteSvg.setAttribute("height", "16");
    deleteSvg.setAttribute("viewBox", "0 0 24 24");
    deleteSvg.setAttribute("fill", "none");
    deleteSvg.setAttribute("stroke", "currentColor");
    deleteSvg.setAttribute("stroke-width", "2");
    deleteSvg.setAttribute("stroke-linecap", "round");
    deleteSvg.setAttribute("stroke-linejoin", "round");
    const deletePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    deletePath.setAttribute("d", "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2");
    deleteSvg.appendChild(deletePath);
    deleteBtn.appendChild(deleteSvg);
    on(deleteBtn, "click", () => onDeleteChat());
    actionBtns.push(deleteBtn);
  }
  actionBtns.push(closeBtn);
  const headerActions = el("div", { class: "kody-header-actions" }, []);
  for (const btn of actionBtns) {
    headerActions.appendChild(btn);
  }
  const header = el("div", { class: "kody-header", role: "banner" }, [headerInfo, headerActions]);

  // ── Messages container ───────────────────────────────────────────────────
  const messagesContainer = el("div", {
    class: "kody-messages",
    role: "log",
    "aria-label": strings.aria.chatMessages,
    "aria-live": "polite",
  });

  // ── Input bar ────────────────────────────────────────────────────────────
  const input = document.createElement("textarea");
  input.className = "kody-input";
  input.placeholder = strings.input.placeholder;
  input.rows = 1;
  input.cols = 1;
  input.wrap = "soft";
  input.autocomplete = "off";
  input.setAttribute("aria-label", strings.input.placeholder);

  function autoResize(): void {
    input.style.height = "auto";
    const maxHeight = 120;
    input.style.height = Math.min(input.scrollHeight, maxHeight) + "px";
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  on(input, "input", autoResize);

  const sendBtn = el("button", {
    class: "kody-send-btn",
    "aria-label": strings.input.send,
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
  const windowEl = el("div", {
    class: "kody-window",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": strings.aria.chatWith(name),
  }, [header, messagesContainer, inputBar]);

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

    setPrefill(text: string): void {
      input.value = text;
      autoResize();
      input.focus();
    },
  };
}
