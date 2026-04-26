import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../../../src/utils/markdown.js";

/** Helper: render markdown and return the innerHTML of a wrapper div. */
function render(md: string): HTMLDivElement {
  const frag = renderMarkdown(md);
  const div = document.createElement("div");
  div.appendChild(frag);
  return div;
}

describe("renderMarkdown", () => {
  it("renders plain text as a paragraph", () => {
    const div = render("hello world");
    const p = div.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe("hello world");
  });

  it("renders **bold** as <strong>", () => {
    const div = render("this is **bold** text");
    const strong = div.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("bold");
  });

  it("renders *italic* as <em>", () => {
    const div = render("this is *italic* text");
    const em = div.querySelector("em");
    expect(em).not.toBeNull();
    expect(em!.textContent).toBe("italic");
  });

  it("renders `code` as <code>", () => {
    const div = render("use `console.log` here");
    const code = div.querySelector("p > code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe("console.log");
  });

  it("renders fenced code blocks as <pre><code>", () => {
    const md = "```\nconst x = 1;\nconst y = 2;\n```";
    const div = render(md);
    const pre = div.querySelector("pre");
    expect(pre).not.toBeNull();
    const code = pre!.querySelector("code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain("const x = 1;");
    expect(code!.textContent).toContain("const y = 2;");
  });

  it("renders [link](https://example.com) as <a> with correct attributes", () => {
    const div = render("visit [Example](https://example.com) now");
    const a = div.querySelector("a");
    expect(a).not.toBeNull();
    expect(a!.textContent).toBe("Example");
    expect(a!.getAttribute("href")).toBe("https://example.com");
    expect(a!.getAttribute("target")).toBe("_blank");
    expect(a!.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does NOT render links with non-http URLs as clickable", () => {
    const div = render("click [here](javascript:alert(1))");
    const a = div.querySelector("a[href]");
    if (a) {
      expect(a.getAttribute("href")).not.toMatch(/^javascript:/);
    }
    expect(div.textContent).toContain("here");
  });

  it("renders unordered lists", () => {
    const md = "- item one\n- item two\n- item three";
    const div = render(md);
    const ul = div.querySelector("ul");
    expect(ul).not.toBeNull();
    const items = ul!.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("item one");
    expect(items[1].textContent).toBe("item two");
    expect(items[2].textContent).toBe("item three");
  });

  it("renders ordered lists", () => {
    const md = "1. first\n2. second\n3. third";
    const div = render(md);
    const ol = div.querySelector("ol");
    expect(ol).not.toBeNull();
    const items = ol!.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("first");
    expect(items[2].textContent).toBe("third");
  });

  it("handles line breaks (two lines become paragraph with <br>)", () => {
    const md = "line one\nline two";
    const div = render(md);
    const p = div.querySelector("p");
    expect(p).not.toBeNull();
    const br = p!.querySelector("br");
    expect(br).not.toBeNull();
    expect(p!.textContent).toBe("line oneline two");
  });

  it("returns a DocumentFragment", () => {
    const frag = renderMarkdown("hello");
    expect(frag).toBeInstanceOf(DocumentFragment);
  });
});
