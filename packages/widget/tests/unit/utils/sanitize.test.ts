import { describe, it, expect } from "vitest";
import { sanitizeText, escapeHtml } from "../../../src/utils/sanitize.js";

describe("sanitizeText", () => {
  it("strips control characters", () => {
    const input = "hello\x00\x01\x02\x03\x7Fworld";
    expect(sanitizeText(input)).toBe("helloworld");
  });

  it("preserves newlines and tabs", () => {
    const input = "line1\nline2\ttabbed\r\nline3";
    expect(sanitizeText(input)).toBe("line1\nline2\ttabbed\r\nline3");
  });

  it("trims whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
    expect(sanitizeText("\n\thello\n\t")).toBe("hello");
  });

  it("enforces max length (10000 chars)", () => {
    const long = "a".repeat(20_000);
    const result = sanitizeText(long);
    expect(result).toHaveLength(10_000);
  });
});

describe("escapeHtml", () => {
  it("escapes &, <, >, \", '", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
    expect(escapeHtml("<script>\"alert('xss')&\"</script>")).toBe(
      "&lt;script&gt;&quot;alert(&#39;xss&#39;)&amp;&quot;&lt;/script&gt;",
    );
  });

  it("leaves normal text unchanged", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });
});
