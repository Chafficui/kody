/** Session and state persistence via browser storage. */

function sessionKey(siteId: string): string {
  return `kody_session_${siteId}`;
}

function messagesKey(siteId: string): string {
  return `kody_messages_${siteId}`;
}

function stateKey(siteId: string): string {
  return `kody_state_${siteId}`;
}

export function getSessionId(siteId: string): string | null {
  try {
    return sessionStorage.getItem(sessionKey(siteId));
  } catch {
    return null;
  }
}

export function setSessionId(siteId: string, sessionId: string): void {
  try {
    sessionStorage.setItem(sessionKey(siteId), sessionId);
  } catch {
    // storage unavailable
  }
}

export function clearSession(siteId: string): void {
  try {
    sessionStorage.removeItem(sessionKey(siteId));
  } catch {
    // storage unavailable
  }
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

export function getStoredMessages(siteId: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(messagesKey(siteId));
    if (!raw) return [];
    return JSON.parse(raw) as StoredMessage[];
  } catch {
    return [];
  }
}

export function storeMessages(siteId: string, messages: StoredMessage[]): void {
  try {
    localStorage.setItem(messagesKey(siteId), JSON.stringify(messages));
  } catch {
    // storage full or unavailable
  }
}

export function clearStoredMessages(siteId: string): void {
  try {
    localStorage.removeItem(messagesKey(siteId));
  } catch {
    // storage unavailable
  }
}

export interface WidgetState {
  isOpen: boolean;
  scrollTop: number;
}

export function getWidgetState(siteId: string): WidgetState | null {
  try {
    const raw = sessionStorage.getItem(stateKey(siteId));
    if (!raw) return null;
    return JSON.parse(raw) as WidgetState;
  } catch {
    return null;
  }
}

export function setWidgetState(siteId: string, state: WidgetState): void {
  try {
    sessionStorage.setItem(stateKey(siteId), JSON.stringify(state));
  } catch {
    // storage unavailable
  }
}

export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Multi-chat conversation storage ──────────────────────────────────────

export interface Conversation {
  id: string;
  sessionId: string | null;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

function conversationsKey(siteId: string): string {
  return `kody_conversations_${siteId}`;
}

function activeConversationKey(siteId: string): string {
  return `kody_active_conversation_${siteId}`;
}

export function getConversations(siteId: string): Conversation[] {
  try {
    const raw = localStorage.getItem(conversationsKey(siteId));
    if (!raw) return [];
    const convos = JSON.parse(raw) as Conversation[];
    return convos.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveConversation(siteId: string, conversation: Conversation): void {
  try {
    const convos = getConversations(siteId);
    const index = convos.findIndex((c) => c.id === conversation.id);
    if (index >= 0) {
      convos[index] = conversation;
    } else {
      convos.push(conversation);
    }
    localStorage.setItem(conversationsKey(siteId), JSON.stringify(convos));
  } catch {
    // storage full or unavailable
  }
}

export function deleteConversation(siteId: string, conversationId: string): void {
  try {
    const convos = getConversations(siteId);
    const filtered = convos.filter((c) => c.id !== conversationId);
    localStorage.setItem(conversationsKey(siteId), JSON.stringify(filtered));
  } catch {
    // storage unavailable
  }
}

export function getActiveConversationId(siteId: string): string | null {
  try {
    return sessionStorage.getItem(activeConversationKey(siteId));
  } catch {
    return null;
  }
}

export function setActiveConversationId(siteId: string, id: string): void {
  try {
    sessionStorage.setItem(activeConversationKey(siteId), id);
  } catch {
    // storage unavailable
  }
}
