import { KodyApiClient, type PublicSiteConfig, type ChatEvent } from "./api/client.js";
import { buildThemeVars } from "./styles/theme.js";
import { createStyleSheet } from "./styles/base.js";
import { createBubble, setBubbleIcon, startBubbleAttention } from "./components/bubble.js";
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
  type StoredMessage,
} from "./utils/session.js";

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

    const themeVars = buildThemeVars(branding.colors);
    const sheet = createStyleSheet(themeVars);
    this.shadow.adoptedStyleSheets = [sheet];

    if (position === "bottom-left") {
      this.host.setAttribute("position", "left");
    }

    this.bubble = createBubble(position, {
      onToggle: () => this.toggle(),
    });

    this.chatWindow = createChatWindow({
      name: this.widgetConfig.branding?.name ?? branding.name,
      tagline: branding.tagline,
      position,
      onClose: () => this.close(),
      onSend: (message) => this.handleSend(message),
      onNewChat: () => this.newChat(),
    });

    this.chatWindow.inputBar.input.placeholder = branding.inputPlaceholder;

    if (this.messages.length > 0) {
      this.restoreMessages();
    } else {
      const welcome = createWelcomeMessage(branding.welcomeMessage);
      this.chatWindow.messagesContainer.appendChild(welcome);
    }

    this.shadow.appendChild(this.chatWindow.element);
    this.shadow.appendChild(this.bubble);

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

  private restoreMessages(): void {
    if (!this.chatWindow) return;
    this.hasMessages = true;
    for (const msg of this.messages) {
      const el = renderMessage(msg);
      this.chatWindow.messagesContainer.appendChild(el);
    }
  }

  private persistMessages(): void {
    storeMessages(this.widgetConfig.siteId, this.messages);
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
    requestAnimationFrame(() => {
      this.chatWindow?.scrollToBottom();
      this.chatWindow?.inputBar.input.focus();
    });
  }

  close(): void {
    if (!this.isOpen || !this.chatWindow || !this.bubble) return;
    this.isOpen = false;
    this.chatWindow.setOpen(false);
    setBubbleIcon(this.bubble, false);
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

  private saveState(): void {
    if (this.chatWindow) {
      setWidgetState(this.widgetConfig.siteId, {
        isOpen: this.isOpen,
        scrollTop: this.chatWindow.messagesContainer.scrollTop,
      });
    }
  }

  private newChat(): void {
    if (!this.chatWindow || !this.config) return;

    this.abortController?.abort();
    this.isStreaming = false;
    this.chatWindow.setLoading(false);

    this.messages = [];
    this.sessionId = null;
    this.hasMessages = false;
    clearStoredMessages(this.widgetConfig.siteId);
    clearSession(this.widgetConfig.siteId);

    while (this.chatWindow.messagesContainer.firstChild) {
      this.chatWindow.messagesContainer.removeChild(this.chatWindow.messagesContainer.firstChild);
    }

    const welcome = createWelcomeMessage(this.config.branding.welcomeMessage);
    this.chatWindow.messagesContainer.appendChild(welcome);
    this.chatWindow.inputBar.input.focus();
  }

  private async handleSend(message: string): Promise<void> {
    if (this.isStreaming || !this.chatWindow) return;

    if (!this.hasMessages) {
      const welcome = this.chatWindow.messagesContainer.querySelector(".kody-welcome");
      if (welcome) welcome.remove();
      this.hasMessages = true;
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

          case "done":
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            streaming.finish();
            if (streamedContent) {
              this.messages.push({ role: "assistant", content: streamedContent });
              this.persistMessages();
            }
            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            this.chatWindow.scrollToBottom();
            this.chatWindow.inputBar.input.focus();
            break;

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
            this.appendAssistantMessage(event.message);
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

          case "sources":
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

  private appendAssistantMessage(content: string): void {
    if (!this.chatWindow) return;
    const msg = renderMessage({ role: "assistant", content });
    this.chatWindow.messagesContainer.appendChild(msg);
    this.chatWindow.scrollToBottom();
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
