/** Typing indicator with bouncing dots. */

import { el } from "../utils/dom.js";

/**
 * Create a typing indicator element with 3 animated dots.
 */
export function createTypingIndicator(): HTMLDivElement {
  const dot1 = el("span", null);
  const dot2 = el("span", null);
  const dot3 = el("span", null);

  return el("div", { class: "kody-typing" }, [dot1, dot2, dot3]);
}
