/**
 * Keyboard shortcut matcher. Parses a comma-separated chord list like
 * `cmd+k,/` and dispatches the first chord that matches the current
 * event. Skips presses that originate from a text-editing element so
 * users can still type `k` in the input.
 */

export type Chord = {
  key: string;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
};

const PRINTABLE = /^[a-z0-9]$/i;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}

function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function parseChord(raw: string): Chord | null {
  const parts = raw
    .split("+")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const chord: Chord = { key: "", meta: false, ctrl: false, alt: false, shift: false };
  for (const p of parts) {
    if (p === "cmd" || p === "meta" || p === "win") chord.meta = true;
    else if (p === "ctrl" || p === "control") chord.ctrl = true;
    else if (p === "alt" || p === "option") chord.alt = true;
    else if (p === "shift") chord.shift = true;
    else if (PRINTABLE.test(p)) chord.key = p;
    else chord.key = p;
  }
  if (chord.key === "") return null;
  return chord;
}

/**
 * Returns null if the spec is invalid / disabled; otherwise a list of
 * chords to listen for. `false` or empty string means "no shortcut".
 */
export function parseShortcutSpec(spec: string | boolean | undefined): Chord[] | null {
  if (spec === false) return null;
  if (spec === undefined) {
    return [parseChord("cmd+k")!, parseChord("/")!];
  }
  if (typeof spec !== "string") return null;
  const chords = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseChord)
    .filter((c): c is Chord => c !== null);
  return chords.length > 0 ? chords : null;
}

export function matchesChord(e: KeyboardEvent, chord: Chord): boolean {
  if (e.metaKey !== chord.meta) return false;
  if (e.ctrlKey !== chord.ctrl) return false;
  if (e.altKey !== chord.alt) return false;
  if (e.shiftKey !== chord.shift) return false;
  return normalizeKey(e.key) === normalizeKey(chord.key);
}

/**
 * Install a global keydown listener that invokes `handler` on the first
 * chord that matches. Skips text-editing targets so the host page's
 * own input handlers still work. Returns the teardown function.
 */
export function installKeyboardShortcut(
  chords: Chord[],
  handler: (e: KeyboardEvent) => void,
): () => void {
  function onKey(e: KeyboardEvent): void {
    // Don't swallow normal typing in the widget input or host page.
    if (isEditableTarget(e.target) && !e.metaKey && !e.ctrlKey) return;
    for (const chord of chords) {
      if (matchesChord(e, chord)) {
        e.preventDefault();
        handler(e);
        return;
      }
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
