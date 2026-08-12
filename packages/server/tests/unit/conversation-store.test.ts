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

  it("mints a fresh sessionId when a cross-site request supplies a site-1 handle", () => {
    // Cross-site collision: a Site A conversation exists at
    // sessionId "abc"; a Site B request re-uses "abc" as its
    // session handle. The cross-site entry must NOT overwrite
    // Site A's row, and the returned sessionId for Site B
    // must be a brand-new UUID — otherwise a later write
    // against "abc" would land in whichever site last
    // registered itself, breaking site isolation.
    store = new ConversationStore();
    const first = store.getOrCreate("site-1");
    const second = store.getOrCreate("site-2", first.sessionId);
    expect(second.sessionId).not.toBe(first.sessionId);
    // Both conversations must still be reachable by their own
    // sessionIds (Site A's row is not silently overwritten).
    expect(store.getIfOwned("site-1", first.sessionId)?.siteId).toBe("site-1");
    expect(store.getIfOwned("site-2", second.sessionId)?.siteId).toBe("site-2");
  });

  it("getIfOwned returns null for unknown sessionId", () => {
    store = new ConversationStore();
    expect(store.getIfOwned("site-1", "does-not-exist")).toBeNull();
  });

  it("getIfOwned returns null when the entry belongs to a different site", () => {
    store = new ConversationStore();
    const first = store.getOrCreate("site-1");
    // The same sessionId is registered under site-1; a
    // site-2 lookup must report "not mine" rather than hand
    // back the site-1 entry.
    expect(store.getIfOwned("site-2", first.sessionId)).toBeNull();
  });

  it("getIfOwned returns the entry when siteId matches", () => {
    store = new ConversationStore();
    const first = store.getOrCreate("site-1");
    const owned = store.getIfOwned("site-1", first.sessionId);
    expect(owned).not.toBeNull();
    expect(owned?.sessionId).toBe(first.sessionId);
  });

  it("getSystemPromptFingerprint returns undefined when no fingerprint is recorded", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    expect(store.getSystemPromptFingerprint(conv.sessionId)).toBeUndefined();
  });

  it("setSystemPromptFingerprint records the supplied value", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    store.setSystemPromptFingerprint(conv.sessionId, "fp-1");
    expect(store.getSystemPromptFingerprint(conv.sessionId)).toBe("fp-1");
  });

  it("setSystemPromptFingerprint is a no-op for an unknown sessionId", () => {
    store = new ConversationStore();
    // Should not throw and should not create a conversation.
    store.setSystemPromptFingerprint("does-not-exist", "fp-x");
    expect(store.getSystemPromptFingerprint("does-not-exist")).toBeUndefined();
  });

  it("updateSystemPrompt replaces the leading system message in place", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    store.addMessage(conv.sessionId, { role: "system", content: "old prompt" });
    store.addMessage(conv.sessionId, { role: "user", content: "hi" });
    store.addMessage(conv.sessionId, { role: "assistant", content: "hello" });
    store.setSystemPromptFingerprint(conv.sessionId, "fp-old");

    store.updateSystemPrompt(conv.sessionId, "new prompt", "fp-new");

    const messages = store.getMessages(conv.sessionId);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "system", content: "new prompt" });
    expect(messages[1]).toEqual({ role: "user", content: "hi" });
    expect(messages[2]).toEqual({ role: "assistant", content: "hello" });
    expect(store.getSystemPromptFingerprint(conv.sessionId)).toBe("fp-new");
  });

  it("updateSystemPrompt is a no-op when there is no system message", () => {
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    store.addMessage(conv.sessionId, { role: "user", content: "hi" });

    store.updateSystemPrompt(conv.sessionId, "new prompt", "fp-new");

    // The user turn is left untouched and the fingerprint
    // was never recorded.
    const messages = store.getMessages(conv.sessionId);
    expect(messages).toEqual([{ role: "user", content: "hi" }]);
    expect(store.getSystemPromptFingerprint(conv.sessionId)).toBeUndefined();
  });

  it("updateSystemPrompt is a no-op for an unknown sessionId", () => {
    store = new ConversationStore();
    // Should not throw and should not create a conversation.
    store.updateSystemPrompt("does-not-exist", "new prompt", "fp-new");
    expect(store.has("does-not-exist")).toBe(false);
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

  it("prependMessage inserts at the head of the transcript", () => {
    // The chat route's missing-system-message fallback uses
    // prependMessage to recover a system prompt ahead of any
    // existing user / assistant turns left behind by a legacy
    // upgrade. Appending the recovered prompt would silently
    // re-order the model input — the recovered system prompt
    // would become the *last* message the model reads, not
    // the first.
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    store.addMessage(conv.sessionId, { role: "user", content: "hi" });
    store.addMessage(conv.sessionId, { role: "assistant", content: "hello" });

    store.prependMessage(conv.sessionId, { role: "system", content: "you are a bot" });

    const messages = store.getMessages(conv.sessionId);
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant"]);
    expect(messages[0]!.content).toBe("you are a bot");
  });

  it("prependMessage is a no-op for an unknown sessionId", () => {
    store = new ConversationStore();
    // Should not throw and should not create a conversation.
    store.prependMessage("does-not-exist", { role: "system", content: "x" });
    expect(store.getMessages("does-not-exist")).toEqual([]);
    expect(store.has("does-not-exist")).toBe(false);
  });

  it("prependMessage at MAX_MESSAGES keeps the prepended system message and trims the oldest turn", () => {
    // Cover the missing-system-message recovery path on a
    // conversation that has *already* grown past the cap. A
    // recovered system prompt is what `prependMessage` is for;
    // the trim must keep it at the head (system messages are
    // never dropped) and retain the newest non-system turns
    // while dropping the oldest.
    store = new ConversationStore();
    const conv = store.getOrCreate("site-1");
    // Fill the conversation with the cap minus one user
    // messages, plus one assistant reply, so the cap is
    // exactly reached before the prepend.
    const cap = 50;
    for (let i = 0; i < cap - 1; i++) {
      store.addMessage(conv.sessionId, { role: "user", content: `u-${i}` });
    }
    store.addMessage(conv.sessionId, { role: "assistant", content: "oldest-assistant" });
    expect(store.getMessages(conv.sessionId)).toHaveLength(cap);

    store.prependMessage(conv.sessionId, { role: "system", content: "recovered prompt" });

    const messages = store.getMessages(conv.sessionId);
    // The cap is still 50; the prepended system message is
    // kept, the oldest user turn ("u-0") is dropped, and the
    // rest of the transcript remains in original order.
    expect(messages).toHaveLength(cap);
    expect(messages[0]).toEqual({ role: "system", content: "recovered prompt" });
    expect(messages.find((m) => m.role === "system")?.content).toBe("recovered prompt");
    // The very oldest user turn ("u-0") should have been
    // trimmed out so the new head count fits the cap.
    expect(messages.some((m) => m.content === "u-0")).toBe(false);
    // The most recent non-system turns are still present
    // and in their original (user, user, ..., assistant)
    // order.
    expect(messages.find((m) => m.content === "oldest-assistant")).toBeDefined();
    const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
    // The newest user turn is still "u-48" (index cap - 2,
    // since "u-0" through "u-48" were the inputs and u-0 was
    // trimmed).
    expect(userMessages[userMessages.length - 1]).toBe("u-48");
  });
});
