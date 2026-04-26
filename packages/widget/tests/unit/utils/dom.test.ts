import { describe, it, expect } from "vitest";
import { el, text, on, show, hide } from "../../../src/utils/dom.js";

describe("el", () => {
  it("creates an element with the correct tag", () => {
    const div = el("div");
    expect(div.tagName).toBe("DIV");

    const span = el("span");
    expect(span.tagName).toBe("SPAN");
  });

  it("sets attributes", () => {
    const div = el("div", { id: "test", class: "foo bar", "data-value": "42" });
    expect(div.getAttribute("id")).toBe("test");
    expect(div.getAttribute("class")).toBe("foo bar");
    expect(div.getAttribute("data-value")).toBe("42");
  });

  it("appends string children as text nodes", () => {
    const div = el("div", null, ["hello", " world"]);
    expect(div.childNodes).toHaveLength(2);
    expect(div.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    expect(div.childNodes[1].nodeType).toBe(Node.TEXT_NODE);
    expect(div.textContent).toBe("hello world");
  });

  it("appends node children", () => {
    const child = el("span", null, ["inner"]);
    const div = el("div", null, [child]);
    expect(div.childNodes).toHaveLength(1);
    expect(div.firstChild).toBe(child);
    expect(div.querySelector("span")).toBe(child);
  });
});

describe("text", () => {
  it("creates a text node with content", () => {
    const node = text("hello");
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe("hello");
  });
});

describe("on", () => {
  it("adds event listener and returns removal function", () => {
    const button = el("button");
    let clicked = false;
    const off = on(button, "click", () => {
      clicked = true;
    });

    button.click();
    expect(clicked).toBe(true);

    // Reset and remove listener
    clicked = false;
    off();

    button.click();
    expect(clicked).toBe(false);
  });
});

describe("show", () => {
  it("removes display:none", () => {
    const div = el("div");
    div.style.display = "none";
    show(div);
    expect(div.style.display).toBe("");
  });
});

describe("hide", () => {
  it("sets display:none", () => {
    const div = el("div");
    hide(div);
    expect(div.style.display).toBe("none");
  });
});
