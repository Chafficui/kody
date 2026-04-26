/** Message rendering helpers. */

import { el, text } from "../utils/dom.js";
import { renderMarkdown } from "../utils/markdown.js";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Render a single chat message (user or assistant).
 *
 * User messages use safe textContent. Assistant messages use the markdown renderer.
 */
export function renderMessage(message: Message): HTMLDivElement {
  const contentDiv = el("div", { class: "kody-message-content" });

  if (message.role === "user") {
    contentDiv.textContent = message.content;
  } else {
    contentDiv.appendChild(renderMarkdown(message.content));
  }

  const wrapper = el(
    "div",
    {
      class: `kody-message kody-message--${message.role}`,
    },
    [contentDiv],
  );

  return wrapper;
}

/**
 * Create a streaming assistant message that can be appended to incrementally.
 *
 * - `append(text)` accumulates text and re-renders the full content via renderMarkdown.
 * - `finish()` does a final render pass.
 */
export function createStreamingMessage(): {
  element: HTMLDivElement;
  append(text: string): void;
  finish(): void;
} {
  let buffer = "";

  const contentDiv = el("div", { class: "kody-message-content" });
  const wrapper = el(
    "div",
    {
      class: "kody-message kody-message--assistant",
    },
    [contentDiv],
  );

  function renderBuffer(): void {
    // Clear existing children
    while (contentDiv.firstChild) {
      contentDiv.removeChild(contentDiv.firstChild);
    }
    contentDiv.appendChild(renderMarkdown(buffer));
  }

  return {
    element: wrapper,

    append(chunk: string): void {
      buffer += chunk;
      renderBuffer();
    },

    finish(): void {
      renderBuffer();
    },
  };
}

/**
 * Create a welcome message element.
 */
export function createWelcomeMessage(welcomeText: string): HTMLDivElement {
  const wrapper = el("div", { class: "kody-welcome" }, [welcomeText]);
  return wrapper;
}
