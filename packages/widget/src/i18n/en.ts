/**
 * String table for the widget UI. Defined as a plain const so it
 * tree-shakes when not referenced. Add new locales by extending the
 * `WidgetStrings` map and a sibling file (e.g. `de.ts`).
 */

export interface WidgetStrings {
  bubble: {
    open: string;
    close: string;
    tooltip: string;
    dismiss: string;
  };
  header: {
    newChat: string;
    closeChat: string;
    deleteConversation: string;
    conversations: string;
  };
  input: {
    placeholder: string;
    send: string;
  };
  messages: {
    welcomeTitle: string;
    rateLimitDaily: string;
    rateLimitMinutes: (n: number) => string;
    rateLimitSeconds: (n: number) => string;
    rateLimitReady: string;
    errorGeneric: string;
    networkError: string;
  };
  feedback: {
    up: string;
    down: string;
  };
  aria: {
    chatWith: (name: string) => string;
    chatMessages: string;
    tooltip: string;
  };
  errors: {
    missingSiteId: string;
  };
}

export const en: WidgetStrings = {
  bubble: {
    open: "Open chat",
    close: "Close chat",
    tooltip: "Need help? Chat with me!",
    dismiss: "Dismiss",
  },
  header: {
    newChat: "New chat",
    closeChat: "Close chat",
    deleteConversation: "Delete conversation",
    conversations: "Conversations",
  },
  input: {
    placeholder: "Type a message...",
    send: "Send message",
  },
  messages: {
    welcomeTitle: "Chat",
    rateLimitDaily: "You've reached the daily message limit.",
    rateLimitMinutes: (n) =>
      `Too many messages. Please wait ${n} minute${n > 1 ? "s" : ""}.`,
    rateLimitSeconds: (n) =>
      `Too many messages. Please wait ${n} second${n !== 1 ? "s" : ""}.`,
    rateLimitReady: "You can send messages again now.",
    errorGeneric: "Something went wrong. Please try again.",
    networkError: "Network error",
  },
  feedback: {
    up: "Helpful",
    down: "Not helpful",
  },
  aria: {
    chatWith: (name) => `Chat with ${name}`,
    chatMessages: "Chat messages",
    tooltip: "Chat invitation",
  },
  errors: {
    missingSiteId:
      "[Kody] Missing siteId. Use data-site-id attribute or window.KodyConfig.",
  },
};

export const SUPPORTED_LOCALES = ["en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Resolve a strings table by locale. Falls back to English when the
 * requested locale is not shipped yet — keeps a single shippable
 * surface area while leaving the hook in place for translations.
 */
export function resolveStrings(locale: string | undefined): WidgetStrings {
  if (!locale) return en;
  const base = locale.split("-")[0]?.toLowerCase();
  if (base === "en") return en;
  return en;
}
