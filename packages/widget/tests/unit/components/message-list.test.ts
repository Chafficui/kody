import { describe, it, expect } from "vitest";
import {
  renderMessage,
  createStreamingMessage,
  createWelcomeMessage,
} from "../../../src/components/message-list.js";

describe("renderMessage", () => {
  it("with role=user creates .kody-message--user element", () => {
    const el = renderMessage({ role: "user", content: "hi" });
    expect(el.classList.contains("kody-message--user")).toBe(true);
  });

  it("with role=assistant creates .kody-message--assistant element", () => {
    const el = renderMessage({ role: "assistant", content: "hello" });
    expect(el.classList.contains("kody-message--assistant")).toBe(true);
  });

  it("user messages render plain text (not markdown)", () => {
    const el = renderMessage({ role: "user", content: "**bold**" });
    const content = el.querySelector(".kody-message-content")!;
    expect(content.textContent).toBe("**bold**");
    expect(content.querySelector("strong")).toBeNull();
  });

  it("assistant messages render markdown (bold/italic produce HTML elements)", () => {
    const el = renderMessage({
      role: "assistant",
      content: "**bold** and *italic*",
    });
    const content = el.querySelector(".kody-message-content")!;
    expect(content.querySelector("strong")).not.toBeNull();
    expect(content.querySelector("em")).not.toBeNull();
  });
});

describe("createStreamingMessage", () => {
  it("starts empty", () => {
    const msg = createStreamingMessage();
    const content = msg.element.querySelector(".kody-message-content")!;
    expect(content.textContent).toBe("");
  });

  it("append adds content", () => {
    const msg = createStreamingMessage();
    msg.append("hello ");
    msg.append("world");
    const content = msg.element.querySelector(".kody-message-content")!;
    expect(content.textContent).toContain("hello");
    expect(content.textContent).toContain("world");
  });

  it("finish does final render", () => {
    const msg = createStreamingMessage();
    msg.append("**done**");
    msg.finish();
    const content = msg.element.querySelector(".kody-message-content")!;
    expect(content.querySelector("strong")).not.toBeNull();
    expect(content.textContent).toContain("done");
  });
});

describe("createWelcomeMessage", () => {
  it("creates .kody-welcome element with text", () => {
    const el = createWelcomeMessage("Welcome!");
    expect(el.classList.contains("kody-welcome")).toBe(true);
    expect(el.textContent).toBe("Welcome!");
  });
});
