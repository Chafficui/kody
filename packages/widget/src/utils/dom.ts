/** Safe DOM creation helpers — no innerHTML anywhere. */

type Child = Node | string;

/** Create an element, set attributes, append children (strings become text nodes). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string> | null,
  children?: Child[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, v);
    }
  }
  if (children) {
    for (const child of children) {
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
  }
  return node;
}

/** Create a text node. */
export function text(content: string): Text {
  return document.createTextNode(content);
}

/** addEventListener wrapper that returns a removal function. */
export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
): () => void;
export function on(element: HTMLElement, event: string, handler: EventListener): () => void;
export function on(element: HTMLElement, event: string, handler: EventListener): () => void {
  element.addEventListener(event, handler);
  return () => element.removeEventListener(event, handler);
}

/** Show an element (remove display:none). */
export function show(element: HTMLElement): void {
  element.style.display = "";
}

/** Hide an element (set display:none). */
export function hide(element: HTMLElement): void {
  element.style.display = "none";
}
