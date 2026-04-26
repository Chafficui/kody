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

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.conversations.clear();
  }
}
