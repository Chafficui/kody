import { KodyApiClient, type PublicSiteConfig, type ChatEvent } from "./api/client.js";
import { buildThemeVars } from "./styles/theme.js";
import { createStyleSheet } from "./styles/base.js";
import { createBubble, setBubbleIcon, setBubbleBadge, startBubbleAttention } from "./components/bubble.js";
import { createChatWindow, type ChatWindow } from "./components/chat-window.js";
import {
  renderMessage,
  createStreamingMessage,
  createWelcomeMessage,
} from "./components/message-list.js";
import { setSourceUrls } from "./utils/markdown.js";
import { createTypingIndicator } from "./components/typing-indicator.js";
import { createTicketForm } from "./components/ticket-form.js";
import { createToolIndicator, type ToolIndicator } from "./components/tool-indicator.js";
import {
  getSessionId,
  setSessionId,
  clearSession,
  getStoredMessages,
  storeMessages,
  clearStoredMessages,
  getWidgetState,
  setWidgetState,
  generateSessionId,
  getConversations,
  saveConversation,
  deleteConversation as deleteConversationFromStorage,
  getActiveConversationId,
  setActiveConversationId,
  type StoredMessage,
  type Conversation,
} from "./utils/session.js";
import { createChatSidebar, type ChatSidebar } from "./components/chat-sidebar.js";

export interface KodyWidgetConfig {
  siteId: string;
  serverUrl: string;
  branding?: {
    name?: string;
    primaryColor?: string;
    position?: "bottom-right" | "bottom-left";
  };
}

export class KodyWidget {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private client: KodyApiClient;
  private config: PublicSiteConfig | null = null;
  private chatWindow: ChatWindow | null = null;
  private bubble: HTMLButtonElement | null = null;
  private isOpen = false;
  private isStreaming = false;
  private abortController: AbortController | null = null;
  private sessionId: string | null = null;
  private hasMessages = false;
  private stopAttention: (() => void) | null = null;
  private messages: StoredMessage[] = [];
  private pendingSources: Array<{ title: string; url?: string; score: number }> | null = null;
  private unreadCount = 0;
  private openCallbacks: Array<() => void> = [];
  private closeCallbacks: Array<() => void> = [];
  private darkModeQuery: MediaQueryList | null = null;
  private conversations: Conversation[] = [];
  private activeConversationId: string | null = null;
  private sidebar: ChatSidebar | null = null;
  private sidebarOpen = false;

  constructor(private widgetConfig: KodyWidgetConfig) {
    this.client = new KodyApiClient(widgetConfig.serverUrl, widgetConfig.siteId);
    this.sessionId = getSessionId(widgetConfig.siteId);
    this.messages = getStoredMessages(widgetConfig.siteId);

    this.host = document.createElement("div");
    this.host.id = "kody-widget";
    this.shadow = this.host.attachShadow({ mode: "closed" });
    document.body.appendChild(this.host);
  }

  async init(): Promise<void> {
    try {
      this.config = await this.client.fetchConfig();
    } catch {
      console.error("[Kody] Failed to fetch config");
      return;
    }

    const branding = this.config.branding;
    const position = this.widgetConfig.branding?.position ?? branding.position;

    if (this.config.sourceUrls) {
      setSourceUrls(this.config.sourceUrls);
    }

    const themeVars = buildThemeVars(branding.colors, {
      theme: branding.theme,
      borderRadius: branding.borderRadius,
      fontFamily: branding.fontFamily,
    });
    const sheet = createStyleSheet(themeVars);
    this.shadow.adoptedStyleSheets = [sheet];

    if (position === "bottom-left") {
      this.host.setAttribute("position", "left");
    }

    const resolvedTheme = branding.theme;
    if (resolvedTheme === "auto") {
      this.darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.host.setAttribute("data-theme", this.darkModeQuery.matches ? "dark" : "light");
      this.darkModeQuery.addEventListener("change", (e) => {
        this.host.setAttribute("data-theme", e.matches ? "dark" : "light");
      });
    } else {
      this.host.setAttribute("data-theme", resolvedTheme);
    }

    this.bubble = createBubble(position, {
      onToggle: () => this.toggle(),
    }, {
      icon: branding.bubbleIcon,
      iconUrl: branding.bubbleIconUrl,
      size: branding.bubbleSize,
    });

    // Load multi-chat conversations
    this.conversations = getConversations(this.widgetConfig.siteId);
    const savedActiveId = getActiveConversationId(this.widgetConfig.siteId);

    if (this.conversations.length > 0) {
      const activeConvo = savedActiveId
        ? this.conversations.find((c) => c.id === savedActiveId)
        : this.conversations[0];
      const convo = activeConvo ?? this.conversations[0];
      this.activeConversationId = convo.id;
      this.sessionId = convo.sessionId;
      this.messages = convo.messages;
      setActiveConversationId(this.widgetConfig.siteId, convo.id);
    } else {
      const convo = this.createNewConversation();
      this.conversations.push(convo);
      this.activeConversationId = convo.id;
      saveConversation(this.widgetConfig.siteId, convo);
      setActiveConversationId(this.widgetConfig.siteId, convo.id);
    }

    this.chatWindow = createChatWindow({
      name: this.widgetConfig.branding?.name ?? branding.name,
      tagline: branding.tagline,
      position,
      onClose: () => this.close(),
      onSend: (message) => this.handleSend(message),
      onNewChat: () => this.newChat(),
      onDeleteChat: this.config.compliance.conversationDeletionEnabled
        ? () => this.deleteChat()
        : undefined,
      onToggleSidebar: () => this.toggleSidebar(),
    });

    this.chatWindow.inputBar.input.placeholder = branding.inputPlaceholder;

    if (this.messages.length > 0) {
      this.restoreMessages();
    } else {
      this.showWelcome();
    }

    // Create the sidebar
    this.sidebar = createChatSidebar({
      conversations: this.conversations,
      activeId: this.activeConversationId,
      onSelect: (id) => this.switchConversation(id),
      onDelete: (id) => this.deleteConversationById(id),
      onNewChat: () => { this.newChat(); this.closeSidebar(); },
      onClose: () => this.closeSidebar(),
    });
    this.chatWindow.element.appendChild(this.sidebar.element);

    this.shadow.appendChild(this.chatWindow.element);
    this.shadow.appendChild(this.bubble);

    this.bubble.classList.add("kody-bubble--pulse");
    this.bubble.addEventListener("animationend", () => {
      this.bubble?.classList.remove("kody-bubble--pulse");
    }, { once: true });

    const savedState = getWidgetState(this.widgetConfig.siteId);
    if (savedState?.isOpen) {
      this.open();
    }

    this.saveStateOnUnload();
    this.setupMobileHandlers();

    const showAttention = !savedState?.isOpen && this.messages.length === 0;
    this.stopAttention = startBubbleAttention(this.bubble, this.shadow, {
      enabled: showAttention,
      message: branding.tagline
        ? `${branding.tagline} — chat with me!`
        : "Need help? Chat with me!",
      delayMs: 5000,
      intervalMs: 10000,
    });
  }

  private showWelcome(): void {
    if (!this.chatWindow || !this.config) return;
    const welcome = createWelcomeMessage(this.config.branding.welcomeMessage, {
      aiDisclosure: this.config.compliance.aiDisclosureEnabled
        ? this.config.compliance.aiDisclosureMessage
        : undefined,
      conversationStarters: this.config.conversationStarters,
      onStarterClick: (text) => this.handleSend(text),
    });
    this.chatWindow.messagesContainer.appendChild(welcome);
  }

  private restoreMessages(): void {
    if (!this.chatWindow) return;
    this.hasMessages = true;
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const msgEl = renderMessage(msg, {
        onFeedback: msg.role === "assistant"
          ? (rating) => this.handleFeedback(i, rating)
          : undefined,
      });
      this.chatWindow.messagesContainer.appendChild(msgEl);
    }
  }

  private persistMessages(): void {
    storeMessages(this.widgetConfig.siteId, this.messages);
    this.saveActiveConversation();
  }

  private saveActiveConversation(): void {
    if (!this.activeConversationId) return;
    const convo = this.conversations.find((c) => c.id === this.activeConversationId);
    if (convo) {
      convo.messages = this.messages;
      convo.sessionId = this.sessionId;
      convo.updatedAt = Date.now();
      saveConversation(this.widgetConfig.siteId, convo);
    }
  }

  private saveStateOnUnload(): void {
    const handler = () => this.saveState();
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
  }

  private setupMobileHandlers(): void {
    if (!this.chatWindow) return;
    const windowEl = this.chatWindow.element;
    const isMobile = () => window.innerWidth <= 480;

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        if (!isMobile() || !this.isOpen) return;
        windowEl.style.height = `${window.visualViewport!.height}px`;
        this.chatWindow?.scrollToBottom();
      });
    }

    const header = windowEl.querySelector(".kody-header") as HTMLElement | null;
    if (header) {
      let startY = 0;
      let currentY = 0;

      header.addEventListener("touchstart", (e: TouchEvent) => {
        if (!isMobile()) return;
        startY = e.touches[0].clientY;
        currentY = startY;
      }, { passive: true });

      header.addEventListener("touchmove", (e: TouchEvent) => {
        if (!isMobile()) return;
        currentY = e.touches[0].clientY;
        const delta = currentY - startY;
        if (delta > 0) {
          windowEl.style.transform = `translateY(${delta}px)`;
        }
      }, { passive: true });

      header.addEventListener("touchend", () => {
        if (!isMobile()) return;
        const delta = currentY - startY;
        windowEl.style.transform = "";
        if (delta > 100) {
          this.close();
        }
      });
    }
  }

  open(): void {
    if (this.isOpen || !this.chatWindow || !this.bubble) return;
    this.isOpen = true;
    this.chatWindow.setOpen(true);
    setBubbleIcon(this.bubble, true);
    this.unreadCount = 0;
    setBubbleBadge(this.bubble, 0);
    const win = this.chatWindow;
    const onEnd = () => {
      win.element.removeEventListener("transitionend", onEnd);
      win.scrollToBottom();
      win.inputBar.input.focus();
    };
    win.element.addEventListener("transitionend", onEnd);
    for (const cb of this.openCallbacks) cb();
  }

  close(): void {
    if (!this.isOpen || !this.chatWindow || !this.bubble) return;
    this.isOpen = false;
    this.chatWindow.setOpen(false);
    setBubbleIcon(this.bubble, false);
    for (const cb of this.closeCallbacks) cb();
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy(): void {
    this.saveState();
    this.abortController?.abort();
    this.stopAttention?.();
    this.host.remove();
  }

  onOpen(callback: () => void): void {
    this.openCallbacks.push(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }

  private saveState(): void {
    if (this.chatWindow) {
      setWidgetState(this.widgetConfig.siteId, {
        isOpen: this.isOpen,
        scrollTop: this.chatWindow.messagesContainer.scrollTop,
      });
    }
    this.saveActiveConversation();
  }

  private createNewConversation(): Conversation {
    const now = Date.now();
    return {
      id: generateSessionId(),
      sessionId: null,
      title: "",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private newChat(): void {
    if (!this.chatWindow || !this.config) return;

    this.abortController?.abort();
    this.isStreaming = false;
    this.chatWindow.setLoading(false);

    // Save current conversation before switching
    this.saveActiveConversation();

    // Create a new conversation
    const convo = this.createNewConversation();
    this.conversations.unshift(convo);
    this.activeConversationId = convo.id;
    saveConversation(this.widgetConfig.siteId, convo);
    setActiveConversationId(this.widgetConfig.siteId, convo.id);

    this.messages = [];
    this.sessionId = null;
    this.hasMessages = false;
    clearStoredMessages(this.widgetConfig.siteId);
    clearSession(this.widgetConfig.siteId);

    while (this.chatWindow.messagesContainer.firstChild) {
      this.chatWindow.messagesContainer.removeChild(this.chatWindow.messagesContainer.firstChild);
    }

    this.showWelcome();
    this.chatWindow.inputBar.input.focus();
    this.updateSidebar();
  }

  private deleteChat(): void {
    if (this.sessionId) {
      this.client.deleteSession(this.sessionId);
    }
    if (this.activeConversationId) {
      this.deleteConversationById(this.activeConversationId);
    } else {
      this.newChat();
    }
  }

  private deleteConversationById(id: string): void {
    deleteConversationFromStorage(this.widgetConfig.siteId, id);
    this.conversations = this.conversations.filter((c) => c.id !== id);

    if (id === this.activeConversationId) {
      // Deleted the active conversation — switch to next or create new
      if (this.conversations.length > 0) {
        this.switchConversation(this.conversations[0].id);
      } else {
        this.activeConversationId = null;
        this.newChat();
      }
    }

    this.updateSidebar();
  }

  private toggleSidebar(): void {
    if (this.sidebarOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  private openSidebar(): void {
    if (!this.sidebar) return;
    this.sidebarOpen = true;
    this.sidebar.element.classList.add("kody-sidebar--open");
    this.updateSidebar();
  }

  private closeSidebar(): void {
    if (!this.sidebar) return;
    this.sidebarOpen = false;
    this.sidebar.element.classList.remove("kody-sidebar--open");
  }

  private updateSidebar(): void {
    if (!this.sidebar) return;
    this.conversations = getConversations(this.widgetConfig.siteId);
    this.sidebar.update(this.conversations, this.activeConversationId);
  }

  private switchConversation(id: string): void {
    if (!this.chatWindow || !this.config) return;
    if (id === this.activeConversationId) {
      this.closeSidebar();
      return;
    }

    // Save current conversation state
    this.saveActiveConversation();

    // Abort any in-progress streaming
    this.abortController?.abort();
    this.isStreaming = false;
    this.chatWindow.setLoading(false);

    // Find the target conversation
    const target = this.conversations.find((c) => c.id === id);
    if (!target) return;

    // Switch to the target conversation
    this.activeConversationId = target.id;
    this.sessionId = target.sessionId;
    this.messages = [...target.messages];
    setActiveConversationId(this.widgetConfig.siteId, target.id);
    if (target.sessionId) {
      setSessionId(this.widgetConfig.siteId, target.sessionId);
    } else {
      clearSession(this.widgetConfig.siteId);
    }
    storeMessages(this.widgetConfig.siteId, this.messages);

    // Clear the messages container
    while (this.chatWindow.messagesContainer.firstChild) {
      this.chatWindow.messagesContainer.removeChild(this.chatWindow.messagesContainer.firstChild);
    }

    // Restore messages or show welcome
    if (this.messages.length > 0) {
      this.hasMessages = true;
      this.restoreMessages();
    } else {
      this.hasMessages = false;
      this.showWelcome();
    }

    this.chatWindow.scrollToBottom();
    this.closeSidebar();
    this.updateSidebar();
  }

  private handleFeedback(messageIndex: number, rating: "up" | "down"): void {
    if (this.sessionId) {
      this.client.sendFeedback(this.sessionId, messageIndex, rating);
    }
  }

  private async handleSend(message: string): Promise<void> {
    if (this.isStreaming || !this.chatWindow) return;

    if (!this.hasMessages) {
      const welcome = this.chatWindow.messagesContainer.querySelector(".kody-welcome");
      if (welcome) welcome.remove();
      this.hasMessages = true;
    }

    // Auto-generate conversation title from first user message
    if (this.activeConversationId && this.messages.length === 0) {
      const convo = this.conversations.find((c) => c.id === this.activeConversationId);
      if (convo && !convo.title) {
        convo.title = message.length > 40 ? message.slice(0, 40) : message;
        saveConversation(this.widgetConfig.siteId, convo);
        this.updateSidebar();
      }
    }

    this.messages.push({ role: "user", content: message });
    this.persistMessages();

    const userMsg = renderMessage({ role: "user", content: message });
    this.chatWindow.messagesContainer.appendChild(userMsg);
    this.chatWindow.scrollToBottom();

    this.isStreaming = true;
    this.chatWindow.setLoading(true);

    const typing = createTypingIndicator();
    this.chatWindow.messagesContainer.appendChild(typing);
    this.chatWindow.scrollToBottom();

    const streaming = createStreamingMessage();
    let typingRemoved = false;
    let streamedContent = "";
    const toolIndicators = new Map<string, ToolIndicator>();
    this.pendingSources = null;
    let pendingSuggestions: string[] = [];

    this.abortController = new AbortController();

    await this.client.sendMessage(message, this.sessionId ?? undefined, {
      signal: this.abortController.signal,
      onEvent: (event: ChatEvent) => {
        if (!this.chatWindow) return;

        switch (event.type) {
          case "session":
            this.sessionId = event.sessionId;
            setSessionId(this.widgetConfig.siteId, event.sessionId);
            break;

          case "delta":
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
              this.chatWindow.messagesContainer.appendChild(streaming.element);
            }
            streamedContent += event.content;
            streaming.append(event.content);
            this.chatWindow.scrollToBottom();
            break;

          case "done": {
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            streaming.finish();
            if (streamedContent) {
              const msgIndex = this.messages.length;
              this.messages.push({ role: "assistant", content: streamedContent });
              this.persistMessages();

              // Replace streaming element with final rendered message (with feedback + sources)
              const finalMsg = renderMessage(
                { role: "assistant", content: streamedContent },
                {
                  onFeedback: (rating) => this.handleFeedback(msgIndex, rating),
                  sources: this.pendingSources ?? undefined,
                },
              );
              streaming.element.replaceWith(finalMsg);

              if (!this.isOpen && this.bubble) {
                this.unreadCount++;
                setBubbleBadge(this.bubble, this.unreadCount);
              }
            }

            // Remove any previous suggestions
            this.chatWindow.messagesContainer
              .querySelectorAll(".kody-suggestions")
              .forEach((el) => el.remove());

            if (pendingSuggestions.length > 0) {
              const suggestionsEl = this.renderSuggestions(pendingSuggestions);
              this.chatWindow.messagesContainer.appendChild(suggestionsEl);
            }

            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            this.chatWindow.scrollToBottom();
            this.chatWindow.inputBar.input.focus();
            break;
          }

          case "rate_limited":
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            this.showRateLimitMessage(event.retryAfterSeconds);
            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            break;

          case "blocked":
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            this.showBlockedMessage(event.message);
            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            break;

          case "error":
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            this.appendAssistantMessage("Something went wrong. Please try again.");
            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            break;

          case "tool_start": {
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            const indicator = createToolIndicator(event.displayText);
            toolIndicators.set(event.name, indicator);
            this.chatWindow.messagesContainer.appendChild(indicator.element);
            this.chatWindow.scrollToBottom();
            break;
          }

          case "tool_end": {
            const ind = toolIndicators.get(event.name);
            if (ind) ind.finish();
            break;
          }

          case "suggestions":
            pendingSuggestions = event.suggestions;
            break;

          case "sources":
            this.pendingSources = event.chunks;
            break;

          case "ticket_prompt":
            if (this.config?.tickets.enabled) {
              this.showTicketForm();
            }
            break;
        }
      },
    });

    if (this.isStreaming) {
      if (!typingRemoved) typing.remove();
      this.isStreaming = false;
      this.chatWindow.setLoading(false);
    }
  }

  private renderSuggestions(suggestions: string[]): HTMLElement {
    const container = document.createElement("div");
    container.className = "kody-suggestions";
    for (const text of suggestions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kody-suggestion-btn";
      btn.textContent = text;
      btn.addEventListener("click", () => {
        container.remove();
        this.handleSend(text);
      });
      container.appendChild(btn);
    }
    return container;
  }

  private appendAssistantMessage(content: string): void {
    if (!this.chatWindow) return;
    const msg = renderMessage({ role: "assistant", content });
    this.chatWindow.messagesContainer.appendChild(msg);
    this.chatWindow.scrollToBottom();
  }

  private showBlockedMessage(content: string): void {
    if (!this.chatWindow || !this.config) return;
    const msg = renderMessage({ role: "assistant", content });
    this.chatWindow.messagesContainer.appendChild(msg);
    this.chatWindow.scrollToBottom();

    if (this.config.tickets.enabled) {
      this.showTicketForm();
    }
  }

  private showRateLimitMessage(retryAfterSeconds: number): void {
    if (!this.chatWindow) return;

    let remaining = retryAfterSeconds;
    const friendly =
      remaining >= 3600
        ? "You've reached the daily message limit."
        : remaining >= 60
          ? `Too many messages. Please wait ${Math.ceil(remaining / 60)} minute${Math.ceil(remaining / 60) > 1 ? "s" : ""}.`
          : `Too many messages. Please wait ${remaining} seconds.`;

    const msg = renderMessage({ role: "assistant", content: friendly });
    this.chatWindow.messagesContainer.appendChild(msg);
    this.chatWindow.scrollToBottom();

    if (remaining < 120) {
      const contentEl = msg.querySelector(".kody-message-content");
      if (!contentEl) return;

      const interval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(interval);
          contentEl.textContent = "You can send messages again now.";
          return;
        }
        contentEl.textContent = `Too many messages. Please wait ${remaining} second${remaining !== 1 ? "s" : ""}.`;
      }, 1000);
    }
  }

  private showTicketForm(): void {
    if (!this.chatWindow || !this.config) return;

    const form = createTicketForm({
      requiredFields: this.config.tickets.requiredFields,
      onSubmit: (_data) => {
        form.setSuccess("Your ticket has been submitted. We'll get back to you soon!");
      },
      onCancel: () => {
        form.element.remove();
      },
    });

    this.chatWindow.messagesContainer.appendChild(form.element);
    this.chatWindow.scrollToBottom();
  }
}
