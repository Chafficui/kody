export interface ToolIndicator {
  element: HTMLDivElement;
  finish(): void;
}

export function createToolIndicator(displayText: string): ToolIndicator {
  const el = document.createElement("div");
  el.className = "kody-tool-indicator";

  const spinner = document.createElement("span");
  spinner.className = "kody-tool-spinner";

  const text = document.createElement("span");
  text.className = "kody-tool-text";
  text.textContent = displayText;

  el.appendChild(spinner);
  el.appendChild(text);

  return {
    element: el,
    finish() {
      el.classList.add("kody-tool-indicator--done");
      spinner.classList.add("kody-tool-spinner--done");
      spinner.textContent = "✓";
    },
  };
}
