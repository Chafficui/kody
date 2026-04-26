import { describe, it, expect } from "vitest";
import { createTypingIndicator } from "../../../src/components/typing-indicator.js";

describe("createTypingIndicator", () => {
  it("creates div with class kody-typing", () => {
    const el = createTypingIndicator();
    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("kody-typing")).toBe(true);
  });

  it("contains exactly 3 span elements", () => {
    const el = createTypingIndicator();
    const spans = el.querySelectorAll("span");
    expect(spans.length).toBe(3);
  });
});
