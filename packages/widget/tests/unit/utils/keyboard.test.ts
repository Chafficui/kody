import { describe, it, expect, vi } from "vitest";
import { parseShortcutSpec, matchesChord, installKeyboardShortcut, parseChord } from "../../../src/utils/keyboard.js";

describe("parseShortcutSpec", () => {
  it("returns null for false", () => {
    expect(parseShortcutSpec(false)).toBeNull();
  });

  it("returns null for invalid strings", () => {
    expect(parseShortcutSpec("")).toBeNull();
    expect(parseShortcutSpec(",")).toBeNull();
  });

  it("defaults to cmd+k and / when undefined", () => {
    const chords = parseShortcutSpec(undefined);
    expect(chords).not.toBeNull();
    expect(chords!.length).toBe(2);
  });

  it("parses a comma-separated chord list", () => {
    const chords = parseShortcutSpec("cmd+k,/")!;
    expect(chords.length).toBe(2);
    expect(chords[0].key).toBe("k");
    expect(chords[0].meta).toBe(true);
    expect(chords[1].key).toBe("/");
  });

  it("normalises modifier names", () => {
    const chords = parseShortcutSpec("ctrl+shift+p")!;
    expect(chords[0].ctrl).toBe(true);
    expect(chords[0].shift).toBe(true);
    expect(chords[0].key).toBe("p");
  });
});

describe("parseChord", () => {
  it("returns null for empty input", () => {
    expect(parseChord("")).toBeNull();
  });

  it("extracts the printable key and modifier flags", () => {
    const c = parseChord("cmd+k")!;
    expect(c.key).toBe("k");
    expect(c.meta).toBe(true);
  });
});

describe("matchesChord", () => {
  it("matches when modifiers and key align", () => {
    const c = parseChord("cmd+k")!;
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    expect(matchesChord(ev, c)).toBe(true);
  });

  it("rejects when a required modifier is missing", () => {
    const c = parseChord("cmd+k")!;
    const ev = new KeyboardEvent("keydown", { key: "k" });
    expect(matchesChord(ev, c)).toBe(false);
  });

  it("rejects on a different key", () => {
    const c = parseChord("cmd+k")!;
    const ev = new KeyboardEvent("keydown", { key: "j", metaKey: true });
    expect(matchesChord(ev, c)).toBe(false);
  });
});

describe("installKeyboardShortcut", () => {
  it("invokes the handler on a matching chord", () => {
    const chords = parseShortcutSpec("cmd+k")!;
    const handler = vi.fn();
    installKeyboardShortcut(chords, handler);

    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not invoke the handler from a text input", () => {
    const chords = parseShortcutSpec("/")!;
    const handler = vi.fn();
    installKeyboardShortcut(chords, handler);

    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      const ev = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
      input.dispatchEvent(ev);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });

  it("returns a teardown that removes the listener", () => {
    const chords = parseShortcutSpec("/")!;
    const handler = vi.fn();
    const off = installKeyboardShortcut(chords, handler);
    off();

    const ev = new KeyboardEvent("keydown", { key: "/" });
    window.dispatchEvent(ev);
    expect(handler).not.toHaveBeenCalled();
  });
});
