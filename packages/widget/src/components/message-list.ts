/** Message rendering helpers. */

import { el, on } from "../utils/dom.js";
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
export function renderMessage(
  message: Message,
  options?: {
    onFeedback?: (rating: "up" | "down") => void;
    sources?: Array<{ title: string; url?: string; score: number }>;
  },
): HTMLDivElement {
  const contentDiv = el("div", { class: "kody-message-content" });

  if (message.role === "user") {
    contentDiv.textContent = message.content;
  } else {
    contentDiv.appendChild(renderMarkdown(message.content));
  }

  const children: Node[] = [contentDiv];

  if (message.role === "assistant" && options?.sources && options.sources.length > 0) {
    children.push(createSourcesList(options.sources));
  }

  if (message.role === "assistant" && options?.onFeedback) {
    children.push(createFeedbackBar(options.onFeedback));
  }

  const wrapper = el(
    "div",
    {
      class: `kody-message kody-message--${message.role}`,
    },
    [],
  );

  for (const child of children) {
    wrapper.appendChild(child);
  }

  return wrapper;
}

function createSourcesList(
  sources: Array<{ title: string; url?: string; score: number }>,
): HTMLDivElement {
  const container = el("div", { class: "kody-sources" });
  const label = el("span", { class: "kody-sources-label" }, ["Sources:"]);
  container.appendChild(label);

  for (const source of sources) {
    if (source.url) {
      const link = el("a", {
        class: "kody-source-link",
        href: source.url,
        target: "_blank",
        rel: "noopener noreferrer",
      }, [source.title || source.url]);
      container.appendChild(link);
    } else {
      container.appendChild(el("span", { class: "kody-source-link" }, [source.title]));
    }
  }

  return container;
}

function createFeedbackBar(onFeedback: (rating: "up" | "down") => void): HTMLDivElement {
  const bar = el("div", { class: "kody-feedback" });

  const upBtn = el("button", {
    class: "kody-feedback-btn",
    "aria-label": "Helpful",
    title: "Helpful",
  });
  upBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;

  const downBtn = el("button", {
    class: "kody-feedback-btn",
    "aria-label": "Not helpful",
    title: "Not helpful",
  });
  downBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`;

  function handleClick(rating: "up" | "down") {
    onFeedback(rating);
    bar.classList.add("kody-feedback--voted");
    if (rating === "up") {
      upBtn.classList.add("kody-feedback-btn--active");
    } else {
      downBtn.classList.add("kody-feedback-btn--active");
    }
    upBtn.disabled = true;
    downBtn.disabled = true;
  }

  on(upBtn, "click", () => handleClick("up"));
  on(downBtn, "click", () => handleClick("down"));

  bar.appendChild(upBtn);
  bar.appendChild(downBtn);
  return bar;
}

/**
 * Create a streaming assistant message that can be appended to incrementally.
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
 * Create a welcome message element with optional AI disclosure and conversation starters.
 */
export function createWelcomeMessage(
  welcomeText: string,
  options?: {
    aiDisclosure?: string;
    conversationStarters?: string[];
    onStarterClick?: (text: string) => void;
  },
): HTMLDivElement {
  const children: Node[] = [];

  if (options?.aiDisclosure) {
    children.push(
      el("div", { class: "kody-ai-disclosure", role: "status", "aria-live": "polite" }, [
        el("span", { class: "kody-ai-disclosure-icon", "aria-hidden": "true" }, ["ℹ️"]),
        el("span", null, [options.aiDisclosure]),
      ]),
    );
  }

  children.push(el("div", { class: "kody-welcome-text" }, [welcomeText]));

  if (options?.conversationStarters && options.conversationStarters.length > 0) {
    const startersContainer = el("div", { class: "kody-starters" });
    for (const starter of options.conversationStarters) {
      const btn = el("button", { class: "kody-starter-btn" }, [starter]);
      on(btn, "click", () => {
        options.onStarterClick?.(starter);
      });
      startersContainer.appendChild(btn);
    }
    children.push(startersContainer);
  }

  const wrapper = el("div", { class: "kody-welcome" }, []);
  for (const child of children) {
    wrapper.appendChild(child);
  }
  return wrapper;
}
