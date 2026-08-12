/**
 * Tiny event emitter for the public `on()` API. Keeps a per-event
 * subscriber list and returns an unsubscribe function so callers can
 * stop listening with a one-liner.
 */
export type EventName = "message" | "open" | "close" | "error" | "feedback";

export type EventPayload =
  | { type: "message"; role: "user" | "assistant"; content: string }
  | { type: "open" }
  | { type: "close" }
  | { type: "error"; message: string }
  | { type: "feedback"; rating: "up" | "down"; messageIndex: number };

export type Listener<T = EventPayload> = (payload: T) => void;

export class EventEmitter {
  private listeners = new Map<EventName, Set<Listener>>();

  on<E extends EventPayload>(name: E["type"], listener: Listener<E>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    // Cast to Listener<unknown> internally — the generic narrows at the call site.
    set.add(listener as Listener);
    return () => this.off(name, listener as Listener);
  }

  off(name: EventName, listener: Listener): void {
    this.listeners.get(name)?.delete(listener);
  }

  emit(payload: EventPayload): void {
    const set = this.listeners.get(payload.type);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(payload);
      } catch (err) {
        console.error("[Kody] event listener threw", err);
      }
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
