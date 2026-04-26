import { describe, it, expect, vi } from "vitest";
import { createBubble, setBubbleIcon } from "../../../src/components/bubble.js";

describe("createBubble", () => {
  it("creates a button element with class kody-bubble", () => {
    const bubble = createBubble("bottom-right", { onToggle: vi.fn() });
    expect(bubble.tagName).toBe("BUTTON");
    expect(bubble.classList.contains("kody-bubble")).toBe(true);
  });

  it("contains an SVG child element", () => {
    const bubble = createBubble("bottom-right", { onToggle: vi.fn() });
    const svg = bubble.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it('sets data-position="left" for bottom-left', () => {
    const bubble = createBubble("bottom-left", { onToggle: vi.fn() });
    expect(bubble.getAttribute("data-position")).toBe("left");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    const bubble = createBubble("bottom-right", { onToggle });
    bubble.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe("setBubbleIcon", () => {
  it('changes aria-label to "Close chat" when open', () => {
    const bubble = createBubble("bottom-right", { onToggle: vi.fn() });
    setBubbleIcon(bubble, true);
    expect(bubble.getAttribute("aria-label")).toBe("Close chat");
  });

  it('changes aria-label to "Open chat" when closed', () => {
    const bubble = createBubble("bottom-right", { onToggle: vi.fn() });
    setBubbleIcon(bubble, true);
    setBubbleIcon(bubble, false);
    expect(bubble.getAttribute("aria-label")).toBe("Open chat");
  });
});
