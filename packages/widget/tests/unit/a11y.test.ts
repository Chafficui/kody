import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createChatWindow } from "../../src/components/chat-window.js";
import { createBubble, setBubbleIcon } from "../../src/components/bubble.js";
import { en } from "../../src/i18n/en.js";
import { installKeyboardShortcut, parseShortcutSpec } from "../../src/utils/keyboard.js";
import { installFocusTrap } from "../../src/utils/focus-trap.js";

describe("widget accessibility", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("chat window", () => {
    it("has role=dialog and aria-modal=true", () => {
      const win = createChatWindow({
        name: "Bot",
        position: "bottom-right",
        onClose: () => {},
        onSend: () => {},
        onNewChat: () => {},
        strings: en,
      });
      document.body.appendChild(win.element);
      expect(win.element.getAttribute("role")).toBe("dialog");
      expect(win.element.getAttribute("aria-modal")).toBe("true");
    });

    it("has a dynamic aria-label that mentions the name", () => {
      const win = createChatWindow({
        name: "Acme",
        position: "bottom-right",
        onClose: () => {},
        onSend: () => {},
        onNewChat: () => {},
        strings: en,
      });
      document.body.appendChild(win.element);
      expect(win.element.getAttribute("aria-label")).toBe("Chat with Acme");
    });

    it("input has an aria-label", () => {
      const win = createChatWindow({
        name: "Bot",
        position: "bottom-right",
        onClose: () => {},
        onSend: () => {},
        onNewChat: () => {},
        strings: en,
      });
      document.body.appendChild(win.element);
      expect(win.inputBar.input.getAttribute("aria-label")).toBeTruthy();
    });

    it("messages container is a log with aria-live=polite", () => {
      const win = createChatWindow({
        name: "Bot",
        position: "bottom-right",
        onClose: () => {},
        onSend: () => {},
        onNewChat: () => {},
        strings: en,
      });
      document.body.appendChild(win.element);
      expect(win.messagesContainer.getAttribute("role")).toBe("log");
      expect(win.messagesContainer.getAttribute("aria-live")).toBe("polite");
    });
  });

  describe("bubble", () => {
    it("has aria-label and toggles between Open / Close", () => {
      const bubble = createBubble("bottom-right", { onToggle: () => {} }, { strings: en });
      document.body.appendChild(bubble);
      expect(bubble.getAttribute("aria-label")).toBe("Open chat");
      setBubbleIcon(bubble, true, en);
      expect(bubble.getAttribute("aria-label")).toBe("Close chat");
      setBubbleIcon(bubble, false, en);
      expect(bubble.getAttribute("aria-label")).toBe("Open chat");
    });
  });

  describe("keyboard shortcut", () => {
    it("Cmd+K invokes the handler", () => {
      const handler = vi.fn();
      const chords = parseShortcutSpec("cmd+k")!;
      const off = installKeyboardShortcut(chords, handler);
      try {
        const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true });
        window.dispatchEvent(ev);
        expect(handler).toHaveBeenCalledOnce();
      } finally {
        off();
      }
    });

    it("a non-matching key does nothing", () => {
      const handler = vi.fn();
      const chords = parseShortcutSpec("cmd+k")!;
      const off = installKeyboardShortcut(chords, handler);
      try {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", metaKey: true }));
        expect(handler).not.toHaveBeenCalled();
      } finally {
        off();
      }
    });
  });

  describe("focus trap", () => {
    it("calls onEscape when Escape is pressed", () => {
      const container = document.createElement("div");
      const btn = document.createElement("button");
      btn.textContent = "x";
      container.appendChild(btn);
      document.body.appendChild(container);

      const onEscape = vi.fn();
      installFocusTrap({ container, onEscape });
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(onEscape).toHaveBeenCalledOnce();
    });
  });
});
