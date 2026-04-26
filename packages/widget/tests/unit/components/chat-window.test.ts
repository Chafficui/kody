import { describe, it, expect, vi } from "vitest";
import { createChatWindow } from "../../../src/components/chat-window.js";

function makeWindow(
  overrides: {
    onClose?: () => void;
    onSend?: (msg: string) => void;
  } = {},
) {
  return createChatWindow({
    name: "Test Bot",
    position: "bottom-right",
    onClose: overrides.onClose ?? vi.fn(),
    onSend: overrides.onSend ?? vi.fn(),
  });
}

describe("createChatWindow", () => {
  it("creates a div with class kody-window", () => {
    const win = makeWindow();
    expect(win.element.tagName).toBe("DIV");
    expect(win.element.classList.contains("kody-window")).toBe(true);
  });

  it("has a messages container (div.kody-messages)", () => {
    const win = makeWindow();
    const messages = win.element.querySelector(".kody-messages");
    expect(messages).not.toBeNull();
    expect(messages!.tagName).toBe("DIV");
  });

  it("has an input bar with input and send button", () => {
    const win = makeWindow();
    expect(win.inputBar.input.tagName).toBe("TEXTAREA");
    expect(win.inputBar.sendBtn.tagName).toBe("BUTTON");
  });

  it("setOpen(true) adds kody-window--open class", () => {
    const win = makeWindow();
    win.setOpen(true);
    expect(win.element.classList.contains("kody-window--open")).toBe(true);
  });

  it("setOpen(false) removes kody-window--open class", () => {
    const win = makeWindow();
    win.setOpen(true);
    win.setOpen(false);
    expect(win.element.classList.contains("kody-window--open")).toBe(false);
  });

  it("setLoading(true) disables input and send button", () => {
    const win = makeWindow();
    win.setLoading(true);
    expect(win.inputBar.input.disabled).toBe(true);
    expect(win.inputBar.sendBtn.disabled).toBe(true);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const win = makeWindow({ onClose });
    const closeBtn = win.element.querySelector(".kody-close-btn") as HTMLButtonElement;
    closeBtn.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onSend when Enter is pressed with text in input", () => {
    const onSend = vi.fn();
    const win = makeWindow({ onSend });
    win.inputBar.input.value = "hello";
    win.inputBar.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("does NOT call onSend on Shift+Enter", () => {
    const onSend = vi.fn();
    const win = makeWindow({ onSend });
    win.inputBar.input.value = "hello";
    win.inputBar.input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }),
    );
    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears input after sending", () => {
    const win = makeWindow({ onSend: vi.fn() });
    win.inputBar.input.value = "hello";
    win.inputBar.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(win.inputBar.input.value).toBe("");
  });
});
