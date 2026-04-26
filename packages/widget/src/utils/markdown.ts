import { marked } from "marked";

const ALLOWED_PROTOCOLS = /^https?:\/\//i;

marked.setOptions({
  gfm: true,
  breaks: true,
});

const renderer = new marked.Renderer();

renderer.link = ({ href, text }) => {
  if (!ALLOWED_PROTOCOLS.test(href)) return text;
  const escaped = href.replace(/"/g, "&quot;");
  return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

renderer.image = ({ href, text }) => {
  return text || href;
};

marked.use({ renderer });

function sanitizeNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    const allowed = new Set([
      "p", "br", "strong", "b", "em", "i", "code", "pre",
      "ul", "ol", "li", "a", "blockquote", "h1", "h2", "h3",
      "h4", "h5", "h6", "hr", "del", "table", "thead", "tbody",
      "tr", "th", "td",
    ]);

    if (!allowed.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      return;
    }

    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      if (!ALLOWED_PROTOCOLS.test(href)) {
        el.removeAttribute("href");
      }
    }

    const children = Array.from(node.childNodes);
    for (const child of children) {
      sanitizeNode(child);
    }
  }
}

const CITE_RE = /\[(\d+)\]/g;

let sourceUrls: Map<string, string> | null = null;

export function setSourceUrls(urls: Record<string, string>): void {
  sourceUrls = new Map(Object.entries(urls));
}

function linkifyCitations(root: Node): void {
  if (!sourceUrls || sourceUrls.size === 0) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (CITE_RE.test(node.textContent || "")) {
      textNodes.push(node);
    }
    CITE_RE.lastIndex = 0;
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || "";
    const parts: Node[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    CITE_RE.lastIndex = 0;
    while ((match = CITE_RE.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const num = match[1];
      const url = sourceUrls!.get(num);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = `[${num}]`;
        a.className = "kody-citation";
        parts.push(a);
      } else {
        parts.push(document.createTextNode(match[0]));
      }
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      parts.push(document.createTextNode(text.slice(lastIdx)));
    }

    const parent = textNode.parentNode;
    if (parent) {
      for (const part of parts) {
        parent.insertBefore(part, textNode);
      }
      parent.removeChild(textNode);
    }
  }
}

export function renderMarkdown(input: string): DocumentFragment {
  const html = marked.parse(input, { async: false }) as string;

  const template = document.createElement("template");
  template.innerHTML = html;

  const frag = template.content;
  const children = Array.from(frag.childNodes);
  for (const child of children) {
    sanitizeNode(child);
  }

  linkifyCitations(frag);

  return frag;
}
