import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "../../../src/utils/emitter.js";

describe("EventEmitter", () => {
  it("delivers a payload to a single subscriber", () => {
    const e = new EventEmitter();
    const cb = vi.fn();
    e.on("open", cb);
    e.emit({ type: "open" });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ type: "open" });
  });

  it("returns an unsubscribe function from on()", () => {
    const e = new EventEmitter();
    const cb = vi.fn();
    const off = e.on("close", cb);
    off();
    e.emit({ type: "close" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers for the same event", () => {
    const e = new EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    e.on("open", a);
    e.on("open", b);
    e.emit({ type: "open" });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("isolates subscribers by event name", () => {
    const e = new EventEmitter();
    const open = vi.fn();
    const close = vi.fn();
    e.on("open", open);
    e.on("close", close);
    e.emit({ type: "open" });
    expect(open).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it("catches a listener that throws and keeps the rest running", () => {
    const e = new EventEmitter();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = vi.fn(() => {
      throw new Error("boom");
    });
    const b = vi.fn();
    e.on("open", a);
    e.on("open", b);
    e.emit({ type: "open" });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("removeAll() drops every subscriber", () => {
    const e = new EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    e.on("open", a);
    e.on("close", b);
    e.removeAll();
    e.emit({ type: "open" });
    e.emit({ type: "close" });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});
