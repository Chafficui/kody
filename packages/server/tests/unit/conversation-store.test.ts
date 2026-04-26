import { describe, it, expect, afterEach } from "vitest";
import { ConversationStore } from "../../src/services/conversation-store.js";

describe("ConversationStore", () => {
  let store: ConversationStore;

  afterEach(() => {
    store?.destroy();
  });

  it("creates a new conversation with a generated sessionId", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    expect(conv.sessionId).toBeDefined();
    expect(conv.sessionId.length).toBeGreaterThan(0);
    expect(conv.siteId).toBe("site-1");
    expect(conv.messages).toEqual([]);
  });

  it("returns existing conversation by sessionId", () => {
    store = new ConversationStore();
    const first = store.getOrCreate("site-1");
    const second = store.getOrCreate("site-1", first.sessionId);
    expect(second.sessionId).toBe(first.sessionId);
  });

  it("creates new conversation if sessionId not found", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1", "nonexistent");
    expect(conv.sessionId).toBe("nonexistent");
    expect(conv.messages).toEqual([]);
  });

  it("creates new conversation if siteId does not match", () => {
    store = new ConversationStore();
    const first = store.getOrCreate("site-1");
    const second = store.getOrCreate("site-2", first.sessionId);
    expect(second.siteId).toBe("site-2");
  });

  it("adds messages to a conversation", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    store.addMessage(conv.sessionId, { role: "user", content: "Hello" });
    store.addMessage(conv.sessionId, { role: "assistant", content: "Hi there!" });

    const messages = store.getMessages(conv.sessionId);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe("user");
    expect(messages[1]!.role).toBe("assistant");
  });

  it("returns empty array for unknown sessionId", () => {
    store = new ConversationStore();
    expect(store.getMessages("unknown")).toEqual([]);
  });

  it("getTranscript excludes system messages", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    store.addMessage(conv.sessionId, { role: "system", content: "You are a bot" });
    store.addMessage(conv.sessionId, { role: "user", content: "Hello" });
    store.addMessage(conv.sessionId, { role: "assistant", content: "Hi!" });

    const transcript = store.getTranscript(conv.sessionId);
    expect(transcript).toHaveLength(2);
    expect(transcript.every((m) => m.role !== "system")).toBe(true);
  });

  it("trims messages when exceeding max, keeping system messages", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    store.addMessage(conv.sessionId, { role: "system", content: "System prompt" });

    for (let i = 0; i < 55; i++) {
      store.addMessage(conv.sessionId, { role: "user", content: `Message ${i}` });
    }

    const messages = store.getMessages(conv.sessionId);
    expect(messages.length).toBeLessThanOrEqual(50);
    expect(messages[0]!.role).toBe("system");
  });
});
