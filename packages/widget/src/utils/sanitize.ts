/** Text sanitization helpers. */

const MAX_LENGTH = 10_000;

// Control chars except \t (0x09), \n (0x0A), \r (0x0D)
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Strip control characters (keeping newlines/tabs), trim whitespace,
 * and enforce a max length of 10 000 characters.
 */
export function sanitizeText(input: string): string {
  return input.replace(CONTROL_CHARS, "").trim().slice(0, MAX_LENGTH);
}

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape HTML special characters — used for attribute contexts only.
 * Normal text rendering uses textContent / createTextNode.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch]);
}
