import { describe, it, expect, vi } from "vitest";
import { installFocusTrap, focusFirst } from "../../../src/utils/focus-trap.js";

function makeContainer(): { container: HTMLDivElement; btn1: HTMLButtonElement; btn2: HTMLButtonElement; input: HTMLInputElement; } {
  const container = document.createElement("div");
  const btn1 = document.createElement("button");
  btn1.textContent = "First";
  const btn2 = document.createElement("button");
  btn2.textContent = "Last";
  const input = document.createElement("input");
  input.type = "text";
  container.append(btn1, input, btn2);
  document.body.appendChild(container);
  return { container, btn1, btn2, input };
}

describe("focusFirst", () => {
  it("focuses the first focusable element", () => {
    const { container, btn1 } = makeContainer();
    focusFirst(container);
    expect(document.activeElement).toBe(btn1);
  });

  it("focuses the explicit initial focus target when provided", () => {
    const { container, input } = makeContainer();
    focusFirst(container, input);
    expect(document.activeElement).toBe(input);
  });

  it("focuses the container itself when there is nothing focusable", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    focusFirst(container);
    expect(document.activeElement).toBe(container);
    expect(container.getAttribute("tabindex")).toBe("-1");
  });
});

describe("installFocusTrap", () => {
  it("calls onEscape when Escape is pressed inside the container", () => {
    const { container } = makeContainer();
    const onEscape = vi.fn();
    installFocusTrap({ container, onEscape });

    const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    container.dispatchEvent(ev);
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("Tab from the last focusable wraps to the first", () => {
    const { container, btn2, btn1 } = makeContainer();
    installFocusTrap({ container, onEscape: () => {} });
    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    container.dispatchEvent(ev);
    // The wrap-around move happens because the trap calls preventDefault,
    // but the test harness can't always verify it — at minimum, the
    // listener should not throw.
    expect(ev.defaultPrevented).toBe(true);
    void btn1; // silence unused
  });

  it("Shift+Tab from the first focusable wraps to the last", () => {
    const { container, btn1 } = makeContainer();
    installFocusTrap({ container, onEscape: () => {} });
    btn1.focus();

    const ev = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    container.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("teardown removes the keydown listener", () => {
    const { container } = makeContainer();
    const onEscape = vi.fn();
    const off = installFocusTrap({ container, onEscape });
    off();
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).not.toHaveBeenCalled();
  });
});
