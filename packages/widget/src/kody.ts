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
import { EventEmitter, type EventName, type EventPayload } from "./utils/emitter.js";
import { installFocusTrap, focusFirst } from "./utils/focus-trap.js";
import { installKeyboardShortcut, parseShortcutSpec } from "./utils/keyboard.js";
import { en, resolveStrings, type WidgetStrings } from "./i18n/en.js";

export const WIDGET_VERSION = "0.2.0";

export interface KodyWidgetConfig {
  siteId: string;
  serverUrl: string;
  branding?: {
    name?: string;
    primaryColor?: string;
    position?: "bottom-right" | "bottom-left";
  };
  // ── Stream B additions ────────────────────────────────────────────────
  locale?: string;
  openOnLoad?: boolean;
  prefillMessage?: string;
  userId?: string;
  userTraits?: Record<string, unknown>;
  theme?: "light" | "dark" | "auto";
  userContext?: Record<string, unknown>;
  keyboardShortcut?: string | boolean;
}

/**
 * The shape exposed to host pages on `window.Kody` and returned from
 * the ESM `mount()` function.
 */
export interface KodyPublicAPI {
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;
  onOpen(callback: () => void): void;
  onClose(callback: () => void): void;
  sendMessage(text: string): Promise<void>;
  prefillInput(text: string): void;
  setUserContext(ctx: Record<string, unknown> | undefined): void;
  setLocale(locale: string): void;
  setTheme(theme: "light" | "dark" | "auto"): void;
  on<E extends EventPayload>(event: E["type"], cb: (payload: E) => void): () => void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  version: string;
  ready: Promise<void>;
}

/**
 * Build the public API surface for an existing widget instance.
 * Shared between the IIFE auto-init (which sets `window.Kody`) and
 * the ESM `mount()` export.
 */
export function buildPublicAPI(widget: KodyWidget): KodyPublicAPI {
  return {
    open: () => widget.open(),
    close: () => widget.close(),
    toggle: () => widget.toggle(),
    destroy: () => widget.destroy(),
    onOpen: (cb) => widget.onOpen(cb),
    onClose: (cb) => widget.onClose(cb),
    sendMessage: (text) => widget.sendMessage(text),
    prefillInput: (text) => widget.prefillInput(text),
    setUserContext: (ctx) => widget.setUserContext(ctx),
    setLocale: (locale) => widget.setLocale(locale),
    setTheme: (theme) => widget.setTheme(theme),
    on: (event, cb) => widget.on(event as EventName, cb as (payload: EventPayload) => void),
    identify: (userId, traits) => widget.identify(userId, traits),
    version: WIDGET_VERSION,
    ready: widget.ready,
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
  private focusTrapTeardown: (() => void) | null = null;
  private openTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private keyboardTeardown: (() => void) | null = null;
  private darkModeListener: ((e: MediaQueryListEvent) => void) | null = null;
  private resolvedTheme: "light" | "dark" | "auto" = "light";
  private strings: WidgetStrings = en;
  private locale: string | undefined;
  private emitter = new EventEmitter();
  private readyResolve!: () => void;
  /** A promise that resolves when init() finishes and the bubble is mounted. */
  public readonly ready: Promise<void> = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  constructor(private widgetConfig: KodyWidgetConfig) {
    this.locale = widgetConfig.locale;
    this.strings = resolveStrings(widgetConfig.locale);
    this.client = new KodyApiClient(widgetConfig.serverUrl, widgetConfig.siteId);
    this.sessionId = getSessionId(widgetConfig.siteId);
    this.messages = getStoredMessages(widgetConfig.siteId);

    if (widgetConfig.userId || widgetConfig.userTraits) {
      this.client.setIdentity({
        userId: widgetConfig.userId ?? "",
        traits: widgetConfig.userTraits,
      });
    }
    if (widgetConfig.userContext) {
      this.client.setUserContext(widgetConfig.userContext);
    }

    this.host = document.createElement("div");
    this.host.id = "kody-widget";
    this.shadow = this.host.attachShadow({ mode: "closed" });
    document.body.appendChild(this.host);
  }

  async init(): Promise<void> {
    try {
      this.config = await this.client.fetchConfig();
    } catch (err) {
      console.error("[Kody] Failed to fetch config", err);
      this.emitter.emit({ type: "error", message: (err as Error).message });
      this.readyResolve();
      return;
    }

    const branding = this.config.branding;
    const position = this.widgetConfig.branding?.position ?? branding.position;
    // Runtime theme override from the embed config wins over server-side.
    this.resolvedTheme = this.widgetConfig.theme ?? branding.theme;

    if (this.config.sourceUrls) {
      setSourceUrls(this.config.sourceUrls);
    }

    const themeVars = buildThemeVars(branding.colors, {
      theme: this.resolvedTheme,
      borderRadius: branding.borderRadius,
      fontFamily: branding.fontFamily,
    });
    const sheet = createStyleSheet(themeVars);
    this.shadow.adoptedStyleSheets = [sheet];

    if (position === "bottom-left") {
      this.host.setAttribute("position", "left");
    }

    if (this.resolvedTheme === "auto") {
      this.darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.host.setAttribute("data-theme", this.darkModeQuery.matches ? "dark" : "light");
      // Store the listener reference so destroy() / setTheme() can
      // detach the same function (removeEventListener needs identity).
      this.darkModeListener = (e) => {
        this.host.setAttribute("data-theme", e.matches ? "dark" : "light");
      };
      this.darkModeQuery.addEventListener("change", this.darkModeListener);
    } else {
      this.host.setAttribute("data-theme", this.resolvedTheme);
    }

    this.bubble = createBubble(position, {
      onToggle: () => this.toggle(),
    }, {
      icon: branding.bubbleIcon,
      iconUrl: branding.bubbleIconUrl,
      size: branding.bubbleSize,
      strings: this.strings,
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
      strings: this.strings,
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
    const shouldOpen = this.widgetConfig.openOnLoad === true || savedState?.isOpen;
    if (shouldOpen) {
      this.open();
    }

    if (this.widgetConfig.prefillMessage) {
      this.prefillInput(this.widgetConfig.prefillMessage);
    }

    this.saveStateOnUnload();
    this.setupMobileHandlers();
    this.installKeyboardShortcut();

    const showAttention = !shouldOpen && this.messages.length === 0;
    this.stopAttention = startBubbleAttention(
      this.bubble,
      this.shadow,
      {
        enabled: showAttention,
        message: branding.tagline
          ? `${branding.tagline} — chat with me!`
          : this.strings.bubble.tooltip,
        delayMs: 5000,
        intervalMs: 10000,
      },
      this.strings,
    );

    this.readyResolve();
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

  private installKeyboardShortcut(): void {
    const chords = parseShortcutSpec(this.widgetConfig.keyboardShortcut);
    if (!chords) return;
    this.keyboardTeardown = installKeyboardShortcut(chords, () => this.toggle());
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
    setBubbleIcon(this.bubble, true, this.strings);
    this.unreadCount = 0;
    setBubbleBadge(this.bubble, 0);
    const win = this.chatWindow;
    // Guard the trap install so transitionend and the fallback timer can
    // both run, but only the first one to fire actually installs the
    // trap. Without this, a rapid open/close/open cycle could leak a
    // keydown listener (e.g. when a keyboard shortcut toggles fast).
    const installTrap = (): void => {
      if (this.focusTrapTeardown) return;
      focusFirst(win.element, win.inputBar.input);
      this.focusTrapTeardown = installFocusTrap({
        container: win.element,
        onEscape: () => this.close(),
      });
    };
    const onEnd = () => {
      win.element.removeEventListener("transitionend", onEnd);
      win.scrollToBottom();
      installTrap();
    };
    win.element.addEventListener("transitionend", onEnd, { once: true });
    // Fallback in case the transitionend event never fires (e.g. reduced motion).
    // Track the timer so close() can cancel a stale one from a prior open cycle.
    this.openTransitionTimer = setTimeout(() => {
      this.openTransitionTimer = null;
      if (this.isOpen) installTrap();
    }, 260);
    for (const cb of this.openCallbacks) cb();
    this.emitter.emit({ type: "open" });
  }

  close(): void {
    if (!this.isOpen || !this.chatWindow || !this.bubble) return;
    this.isOpen = false;
    this.chatWindow.setOpen(false);
    setBubbleIcon(this.bubble, false, this.strings);
    if (this.openTransitionTimer) {
      clearTimeout(this.openTransitionTimer);
      this.openTransitionTimer = null;
    }
    if (this.focusTrapTeardown) {
      this.focusTrapTeardown();
      this.focusTrapTeardown = null;
    }
    // Return focus to the bubble so keyboard users can re-open the
    // chat without tabbing through the whole page (WCAG 2.4.3).
    this.bubble.focus();
    for (const cb of this.closeCallbacks) cb();
    this.emitter.emit({ type: "close" });
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
    if (this.openTransitionTimer) {
      clearTimeout(this.openTransitionTimer);
      this.openTransitionTimer = null;
    }
    if (this.focusTrapTeardown) {
      this.focusTrapTeardown();
      this.focusTrapTeardown = null;
    }
    if (this.keyboardTeardown) {
      this.keyboardTeardown();
      this.keyboardTeardown = null;
    }
    if (this.darkModeQuery && this.darkModeListener) {
      this.darkModeQuery.removeEventListener("change", this.darkModeListener);
      this.darkModeQuery = null;
      this.darkModeListener = null;
    }
    this.emitter.removeAll();
    this.host.remove();
  }

  onOpen(callback: () => void): void {
    this.openCallbacks.push(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }

  /**
   * Send a message as if the user typed it. Resolves when the message
   * is queued for delivery — the response is delivered via the
   * `message` event on the emitter. Throws if the widget is not
   * initialised yet.
   */
  sendMessage(text: string): Promise<void> {
    if (!this.config) {
      return Promise.reject(new Error("[Kody] Widget not ready; await Kody.ready"));
    }
    if (!text || typeof text !== "string") {
      return Promise.reject(new Error("[Kody] sendMessage requires a non-empty string"));
    }
    if (!this.isOpen) {
      this.open();
    }
    this.handleSend(text);
    return Promise.resolve();
  }

  /**
   * Put text in the input without sending. The user can edit and
   * submit manually. Opens the chat if it isn't open.
   */
  prefillInput(text: string): void {
    if (!this.chatWindow) return;
    if (!this.isOpen) this.open();
    this.chatWindow.setPrefill(text);
  }

  /**
   * Attach metadata to every future message. The value is sent to the
   * server as the `x-kody-user-context` header. Pass `undefined` to
   * clear.
   */
  setUserContext(ctx: Record<string, unknown> | undefined): void {
    this.client.setUserContext(ctx);
  }

  /**
   * Mark a known user. The userId is sent with every request as
   * `x-kody-user-id`; traits are JSON-encoded into
   * `x-kody-user-traits`. Pass undefined for either field to clear.
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    this.client.setIdentity({ userId, traits });
  }

  /**
   * Switch the active locale. Currently only ships `en`; calling this
   * with another locale is accepted but falls back to English until a
   * translation is added.
   */
  setLocale(locale: string): void {
    this.locale = locale;
    this.strings = resolveStrings(locale);
    // Re-render visible strings by rebuilding header labels.
    if (this.chatWindow) {
      this.chatWindow.inputBar.input.placeholder = this.config?.branding.inputPlaceholder ?? this.strings.input.placeholder;
      this.chatWindow.inputBar.input.setAttribute("aria-label", this.strings.input.placeholder);
    }
  }

  /**
   * Runtime override of the theme. Re-runs the same logic init() used
   * to set `data-theme` on the host. Pass "auto" to follow the OS.
   */
  setTheme(theme: "light" | "dark" | "auto"): void {
    this.resolvedTheme = theme;
    // Detach any prior auto listener before re-binding or switching away.
    if (this.darkModeQuery && this.darkModeListener) {
      this.darkModeQuery.removeEventListener("change", this.darkModeListener);
      this.darkModeQuery = null;
      this.darkModeListener = null;
    }
    if (theme === "auto") {
      this.darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.host.setAttribute("data-theme", this.darkModeQuery.matches ? "dark" : "light");
      this.darkModeListener = (e) => {
        this.host.setAttribute("data-theme", e.matches ? "dark" : "light");
      };
      this.darkModeQuery.addEventListener("change", this.darkModeListener);
    } else {
      this.host.setAttribute("data-theme", theme);
    }
  }

  /**
   * Subscribe to a widget event. Returns an unsubscribe function so
   * listeners can be removed with a single call.
   */
  on(name: EventName, listener: (payload: EventPayload) => void): () => void {
    return this.emitter.on(name, listener);
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
    this.emitter.emit({ type: "feedback", rating, messageIndex });
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
    this.emitter.emit({ type: "message", role: "user", content: message });
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
              this.emitter.emit({ type: "message", role: "assistant", content: streamedContent });

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

          case "rate_limited": {
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            this.showRateLimitMessage(event.retryAfterSeconds);
            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            this.emitter.emit({ type: "error", message: "rate_limited" });
            break;
          }

          case "blocked": {
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            this.showBlockedMessage(event.message);
            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            break;
          }

          case "error":
            if (!typingRemoved) {
              typing.remove();
              typingRemoved = true;
            }
            this.appendAssistantMessage(this.strings.messages.errorGeneric);
            this.isStreaming = false;
            this.chatWindow.setLoading(false);
            this.emitter.emit({ type: "error", message: event.message });
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
        ? this.strings.messages.rateLimitDaily
        : remaining >= 60
          ? this.strings.messages.rateLimitMinutes(Math.ceil(remaining / 60))
          : this.strings.messages.rateLimitSeconds(remaining);

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
          contentEl.textContent = this.strings.messages.rateLimitReady;
          return;
        }
        contentEl.textContent = this.strings.messages.rateLimitSeconds(remaining);
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
