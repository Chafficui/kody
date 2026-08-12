import { randomUUID } from "crypto";
import type { ChatMessage } from "@kody/shared";

interface Conversation {
  sessionId: string;
  siteId: string;
  messages: ChatMessage[];
  lastActivity: number;
  /**
   * Configuration fingerprint captured at the moment the
   * leading system message was built. Used by the chat route
   * to decide whether an existing system prompt is still
   * aligned with the current site config — a mismatch means
   * the admin changed `personality`, guardrails, knowledge
   * sources, or `ai.systemPromptPrefix` after the conversation
   * began, and the stored prompt no longer reflects what the
   * AI should be told to obey.
   *
   * Stored on the conversation rather than inside the system
   * message itself so the public `ChatMessage` shape stays
   * unchanged (the model would otherwise see a fingerprint
   * token it does not understand). `undefined` is treated as
   * "always rebuild" — a conversation that pre-dates this
   * field is assumed to be stale, which is the safe default
   * for an admin who just edited the config.
   */
  systemPromptFingerprint?: string;
}

const MAX_MESSAGES = 50;
const TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONVERSATIONS = 10_000;

export class ConversationStore {
  private conversations = new Map<string, Conversation>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  getOrCreate(siteId: string, sessionId?: string): Conversation {
    if (sessionId) {
      const existing = this.conversations.get(sessionId);
      if (existing && existing.siteId === siteId) {
        existing.lastActivity = Date.now();
        return existing;
      }
      // A sessionId was supplied but either the entry does not
      // exist (expired conversation) or it belongs to a
      // different site. In the cross-site case we MUST NOT reuse
      // the incoming id — `conversations.set(newSessionId, ...)`
      // would silently overwrite the other site's entry under
      // the same key, allowing a later write to land in the
      // wrong site's transcript. Mint a fresh UUID instead so
      // each site retains a stable, isolated conversation.
      const newSessionId = existing ? randomUUID() : sessionId || randomUUID();
      const conversation: Conversation = {
        sessionId: newSessionId,
        siteId,
        messages: [],
        lastActivity: Date.now(),
      };

      if (this.conversations.size >= MAX_CONVERSATIONS) {
        this.evictOldest();
      }

      this.conversations.set(newSessionId, conversation);
      return conversation;
    }

    const newSessionId = randomUUID();
    const conversation: Conversation = {
      sessionId: newSessionId,
      siteId,
      messages: [],
      lastActivity: Date.now(),
    };

    if (this.conversations.size >= MAX_CONVERSATIONS) {
      this.evictOldest();
    }

    this.conversations.set(newSessionId, conversation);
    return conversation;
  }

  /**
   * Return the conversation for `sessionId` only when the
   * supplied `siteId` matches the conversation's owning site.
   * Returns `null` when the entry is missing OR when it is
   * owned by a different site.
   *
   * Used by the chat route's write-time session resolver to
   * distinguish "still my site's conversation" from "a stale
   * or cross-site handle that must not be written into". The
   * check is intentionally a single Map lookup + site equality
   * test so it is atomic with respect to concurrent
   * `getOrCreate` calls — the previous `has(initialSessionId)`
   * helper accepted any entry, which let a Site A stream
   * write its assistant message into a Site B conversation
   * after a Site B request had replaced the entry under the
   * same id.
   */
  getIfOwned(siteId: string, sessionId: string): Conversation | null {
    const existing = this.conversations.get(sessionId);
    if (!existing) return null;
    if (existing.siteId !== siteId) return null;
    existing.lastActivity = Date.now();
    return existing;
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    conversation.messages.push(message);
    conversation.lastActivity = Date.now();

    this.trimToMax(conversation);
  }

  /**
   * Insert a message at the **beginning** of the conversation
   * history, ahead of any existing system / user / assistant
   * turns. Used by the chat route's missing-system-message
   * fallback: a legacy conversation may already have user and
   * assistant turns stored without a leading system message,
   * and the recovered system prompt must precede them so the
   * model still sees it first. `addMessage` would silently
   * append to the tail — a hard ordering bug because the
   * recovered system prompt would be the *last* thing the
   * model reads instead of the first.
   *
   * The same `MAX_MESSAGES` cap as `addMessage` applies. A
   * prepended **system** message is preserved by the trim
   * (system messages are never dropped — see `trimToMax`),
   * so a prepended system prompt always remains at the head
   * of the transcript after the cap kicks in. A prepended
   * non-system message follows the same retention rule as
   * `addMessage`: the newest `MAX_MESSAGES - systemCount`
   * non-system turns are kept and the oldest are dropped.
   */
  prependMessage(sessionId: string, message: ChatMessage): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    conversation.messages.unshift(message);
    conversation.lastActivity = Date.now();

    this.trimToMax(conversation);
  }

  /**
   * Returns true if a conversation exists for the supplied sessionId.
   * Used by the chat route to distinguish "expired conversation"
   * (re-derive a new one) from "still-alive conversation that just
   * happens to be empty" (use the original sessionId). Note that
   * `getMessages` returns an empty array for a missing session, so
   * the previous `getMessages(...).length > 0` guard could not
   * distinguish those two cases.
   */
  has(sessionId: string): boolean {
    return this.conversations.has(sessionId);
  }

  /**
   * Return the configuration fingerprint captured at the moment
   * the leading system message was built, or `undefined` when
   * no fingerprint is on file (a conversation that pre-dates
   * the fingerprint field, or a fresh conversation that hasn't
   * had its system prompt recorded yet). The chat route uses
   * this to decide whether the existing system prompt is still
   * aligned with the current site config — see
   * `buildAndStoreSystemPrompt`.
   */
  getSystemPromptFingerprint(sessionId: string): string | undefined {
    return this.conversations.get(sessionId)?.systemPromptFingerprint;
  }

  /**
   * Replace the content of the leading system message in place
   * and persist the new configuration fingerprint alongside it.
   * Used by the chat route when an admin changes the site
   * config mid-conversation: the existing system prompt is
   * stale, so we rewrite it to reflect the new config without
   * disturbing the user / assistant transcript.
   *
   * A no-op when the conversation is missing or has no system
   * message — the caller is responsible for using `addMessage`
   * or `prependMessage` to install a system message in those
   * cases.
   */
  updateSystemPrompt(sessionId: string, content: string, fingerprint: string): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;
    const systemIndex = conversation.messages.findIndex((m) => m.role === "system");
    if (systemIndex === -1) return;
    conversation.messages[systemIndex] = { role: "system", content };
    conversation.systemPromptFingerprint = fingerprint;
    conversation.lastActivity = Date.now();
  }

  /**
   * Record the configuration fingerprint for a system message
   * that was just installed via `addMessage` or
   * `prependMessage`. The chat route uses this on the
   * brand-new-conversation and legacy-recovery paths, where
   * the system message is created by a vanilla add/prepend
   * call rather than by `updateSystemPrompt` (which handles
   * the fingerprint itself). A no-op when the conversation
   * does not exist; we deliberately do not require the system
   * message to already be present because the caller may
   * invoke this in the same tick as the add/prepend.
   */
  setSystemPromptFingerprint(sessionId: string, fingerprint: string): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;
    conversation.systemPromptFingerprint = fingerprint;
  }

  getMessages(sessionId: string): ChatMessage[] {
    return this.conversations.get(sessionId)?.messages ?? [];
  }

  getTranscript(sessionId: string): ChatMessage[] {
    return this.getMessages(sessionId).filter((m) => m.role !== "system");
  }

  /**
   * Trim a conversation back to the `MAX_MESSAGES` cap while
   * keeping every system message (so a recovered system
   * prompt is never silently dropped) and the most recent
   * non-system turns. Shared by `addMessage` and
   * `prependMessage` so the retention policy is enforced in
   * exactly one place — a future change to the cap or to the
   * system-message rule is automatically picked up by both
   * storage paths.
   */
  private trimToMax(conversation: Conversation): void {
    if (conversation.messages.length <= MAX_MESSAGES) return;
    const systemMessages = conversation.messages.filter((m) => m.role === "system");
    const nonSystemMessages = conversation.messages.filter((m) => m.role !== "system");
    const trimmed = nonSystemMessages.slice(-MAX_MESSAGES + systemMessages.length);
    conversation.messages = [...systemMessages, ...trimmed];
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [id, conv] of this.conversations) {
      if (conv.lastActivity < oldestTime) {
        oldestTime = conv.lastActivity;
        oldest = id;
      }
    }

    if (oldest) {
      this.conversations.delete(oldest);
    }
  }

  private cleanup(): void {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, conv] of this.conversations) {
      if (conv.lastActivity < cutoff) {
        this.conversations.delete(id);
      }
    }
  }

  delete(sessionId: string): boolean {
    return this.conversations.delete(sessionId);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.conversations.clear();
  }
}
