import { randomUUID } from "crypto";
import type { ChatMessage } from "@kody/shared";

interface Conversation {
  sessionId: string;
  siteId: string;
  messages: ChatMessage[];
  lastActivity: number;
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
    }

    const newSessionId = sessionId || randomUUID();
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

  addMessage(sessionId: string, message: ChatMessage): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    conversation.messages.push(message);
    conversation.lastActivity = Date.now();

    if (conversation.messages.length > MAX_MESSAGES) {
      const systemMessages = conversation.messages.filter((m) => m.role === "system");
      const nonSystemMessages = conversation.messages.filter((m) => m.role !== "system");
      const trimmed = nonSystemMessages.slice(-MAX_MESSAGES + systemMessages.length);
      conversation.messages = [...systemMessages, ...trimmed];
    }
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
   * The same `MAX_MESSAGES` cap as `addMessage` applies; the
   * prepended message is treated as a non-system message for
   * the trim, so a conversation that has already grown past
   * the cap will keep its most recent user/assistant turns
   * and the prepended system message is preserved (the cap
   * already special-cases system messages to never be
   * trimmed).
   */
  prependMessage(sessionId: string, message: ChatMessage): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    conversation.messages.unshift(message);
    conversation.lastActivity = Date.now();

    if (conversation.messages.length > MAX_MESSAGES) {
      const systemMessages = conversation.messages.filter((m) => m.role === "system");
      const nonSystemMessages = conversation.messages.filter((m) => m.role !== "system");
      const trimmed = nonSystemMessages.slice(-MAX_MESSAGES + systemMessages.length);
      conversation.messages = [...systemMessages, ...trimmed];
    }
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

  getMessages(sessionId: string): ChatMessage[] {
    return this.conversations.get(sessionId)?.messages ?? [];
  }

  getTranscript(sessionId: string): ChatMessage[] {
    return this.getMessages(sessionId).filter((m) => m.role !== "system");
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
