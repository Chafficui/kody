/**
 * Focus trap for the chat dialog. While the chat is open, Tab and
 * Shift+Tab cycle through focusable elements inside the container
 * instead of escaping to the host page. Escape closes the dialog.
 */

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.hasAttribute("aria-hidden") && !el.hasAttribute("disabled"),
  );
}

export interface FocusTrapOptions {
  container: HTMLElement;
  initialFocus?: HTMLElement | null;
  onEscape: () => void;
}

/**
 * Install a focus trap. Returns the teardown function. The trap is
 * idempotent across opens/closes — call it once at init and use the
 * returned teardown for full teardown only.
 */
export function installFocusTrap(options: FocusTrapOptions): () => void {
  const { container, onEscape } = options;

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  container.addEventListener("keydown", onKey);
  return () => container.removeEventListener("keydown", onKey);
}

/**
 * Move focus to the first focusable element inside the container, or
 * to the explicit initialFocus target if provided. Falls back to the
 * container itself.
 */
export function focusFirst(container: HTMLElement, initialFocus?: HTMLElement | null): void {
  if (initialFocus) {
    initialFocus.focus();
    return;
  }
  const focusable = getFocusable(container);
  if (focusable.length > 0) {
    focusable[0].focus();
    return;
  }
  if (!container.hasAttribute("tabindex")) {
    container.setAttribute("tabindex", "-1");
  }
  container.focus();
}
