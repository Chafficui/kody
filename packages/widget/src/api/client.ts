export interface PublicSiteConfig {
  siteId: string;
  branding: {
    name: string;
    tagline?: string;
    logoUrl?: string;
    colors: {
      primary: string;
      primaryForeground: string;
      background: string;
      foreground: string;
      bubbleBackground: string;
      userBubbleBackground: string;
      userBubbleForeground: string;
    };
    position: "bottom-right" | "bottom-left";
    welcomeMessage: string;
    inputPlaceholder: string;
    bubbleIcon: "chat" | "headset" | "robot" | "custom";
    bubbleIconUrl?: string;
    bubbleSize: "sm" | "md" | "lg";
    theme: "light" | "dark" | "auto";
    borderRadius: number;
    fontFamily?: string;
  };
  tickets: {
    enabled: boolean;
    promptMessage: string;
    requiredFields: string[];
  };
  personality: {
    tone: "friendly" | "professional" | "casual";
    formality: "formal" | "informal" | "balanced";
    responseLength: "concise" | "balanced" | "detailed";
  };
  compliance: {
    aiDisclosureEnabled: boolean;
    aiDisclosureMessage: string;
    conversationDeletionEnabled: boolean;
  };
  conversationStarters: string[];
  sourceUrls?: Record<string, string>;
}

export type ChatEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; content: string }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "rate_limited"; retryAfterSeconds: number }
  | { type: "blocked"; message: string }
  | { type: "ticket_prompt"; message: string }
  | { type: "tool_start"; name: string; displayText: string }
  | { type: "tool_end"; name: string }
  | { type: "sources"; chunks: Array<{ title: string; url?: string; score: number }> }
  | { type: "suggestions"; suggestions: string[] };

import { isTrustedServerUrl } from "../utils/url.js";

export interface IdentifyTraits {
  userId: string;
  traits?: Record<string, unknown>;
}

export class KodyApiClient {
  private userContext: Record<string, unknown> | undefined;
  private identity: IdentifyTraits | undefined;
  /**
   * True only when `baseUrl` is HTTPS or an explicit loopback host.
   * Identity / context headers are withheld for any other plain-HTTP
   * origin so we never leak `x-kody-user-id` etc. to a non-trusted
   * upstream.
   */
  private readonly allowIdentity: boolean;

  constructor(
    private baseUrl: string,
    private siteId: string,
  ) {
    this.allowIdentity = isTrustedServerUrl(baseUrl);
  }

  setUserContext(ctx: Record<string, unknown> | undefined): void {
    this.userContext = ctx && Object.keys(ctx).length > 0 ? ctx : undefined;
  }

  setIdentity(identity: IdentifyTraits | undefined): void {
    this.identity = identity;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-kody-site-id": this.siteId,
    };
    if (extra) Object.assign(headers, extra);
    return headers;
  }

  /**
   * Build the per-message header set: site id + the current identity
   * (user id + traits) and userContext, with a bounded size check so
   * a single misconfigured site can't blow up the request line.
   *
   * Identity and context headers are only attached when the resolved
   * base URL is trusted (HTTPS or an explicit loopback exception).
   * Otherwise we forward only the public site id — the chat itself
   * still works, but no user-identifying data leaves the page.
   */
  private buildMessageHeaders(): Record<string, string> {
    const headers: Record<string, string> = this.buildHeaders();
    if (!this.allowIdentity) return headers;
    if (this.identity) {
      headers["x-kody-user-id"] = this.identity.userId;
      if (this.identity.traits) {
        const traits = this.trySerialize(this.identity.traits, 4096);
        if (traits !== undefined) headers["x-kody-user-traits"] = traits;
      }
    }
    if (this.userContext) {
      const ctx = this.trySerialize(this.userContext, 4096);
      if (ctx !== undefined) headers["x-kody-user-context"] = ctx;
    }
    return headers;
  }

  private trySerialize(value: unknown, maxBytes: number): string | undefined {
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch {
      return undefined;
    }
    if (raw === undefined) return undefined;
    // Measure UTF-8 bytes, not JS string length. The HTTP header has
    // a byte budget; a non-ASCII character can be 1–4 bytes, so
    // `raw.length` systematically over-states the size of CJK /
    // emoji content and would let oversized payloads through.
    if (new TextEncoder().encode(raw).byteLength > maxBytes) return undefined;
    return raw;
  }

  async fetchConfig(): Promise<PublicSiteConfig> {
    const res = await fetch(`${this.baseUrl}/api/config/${this.siteId}`, {
      headers: this.buildHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch config: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<PublicSiteConfig>;
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: this.buildMessageHeaders(),
        // Identity-bearing request: do not follow redirects. Fetch
        // strips `Authorization` on cross-origin redirect but would
        // forward our custom `x-kody-user-*` headers, leaking identity
        // to a different host if the server ever redirects.
        redirect: "error",
      });
    } catch {
      // best-effort deletion
    }
  }

  async sendFeedback(
    sessionId: string,
    messageIndex: number,
    rating: "up" | "down",
  ): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/feedback`, {
        method: "POST",
        headers: this.buildMessageHeaders(),
        // Identity-bearing request: do not follow redirects. See
        // deleteSession() for the rationale.
        redirect: "error",
        body: JSON.stringify({
          siteId: this.siteId,
          sessionId,
          messageIndex,
          rating,
        }),
      });
    } catch {
      // best-effort feedback
    }
  }

  async sendMessage(
    message: string,
    sessionId?: string,
    options?: {
      onEvent: (event: ChatEvent) => void;
      signal?: AbortSignal;
    },
  ): Promise<void> {
    const onEvent = options?.onEvent;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: this.buildMessageHeaders(),
        // Identity-bearing request: do not follow redirects. See
        // deleteSession() for the rationale.
        redirect: "error",
        body: JSON.stringify({
          siteId: this.siteId,
          sessionId,
          message,
        }),
        signal: options?.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      onEvent?.({ type: "error", message: networkErrorMessage(err) });
      return;
    }

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
        onEvent?.({ type: "rate_limited", retryAfterSeconds: retryAfter });
      } else {
        onEvent?.({
          type: "error",
          message: `Server error: ${res.status} ${res.statusText}`,
        });
      }
      return;
    }

    const body = res.body;
    if (!body) {
      onEvent?.({ type: "error", message: "Response body is empty" });
      return;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines.
        // Process all complete events in the buffer.
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const event = parseSSEChunk(raw);
          if (event) {
            onEvent?.(event);
          }
        }
      }

      // Flush any remaining data (server may not send a trailing \n\n)
      if (buffer.trim().length > 0) {
        const event = parseSSEChunk(buffer);
        if (event) {
          onEvent?.(event);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      onEvent?.({ type: "error", message: networkErrorMessage(err) });
    }
  }
}

/**
 * Parse an SSE chunk (one or more `data:` lines between double-newline
 * boundaries) and return a ChatEvent, or null if the chunk is empty /
 * unparseable.
 */
function parseSSEChunk(raw: string): ChatEvent | null {
  // An SSE chunk can contain multiple lines; we care about `data:` lines.
  const lines = raw.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const json = line.slice("data: ".length).trim();
      if (json === "") continue;
      try {
        return JSON.parse(json) as ChatEvent;
      } catch {
        return { type: "error", message: "Failed to parse server event" };
      }
    }
    // Tolerate `data:` without a space (edge case).
    if (line.startsWith("data:")) {
      const json = line.slice("data:".length).trim();
      if (json === "") continue;
      try {
        return JSON.parse(json) as ChatEvent;
      } catch {
        return { type: "error", message: "Failed to parse server event" };
      }
    }
  }
  return null;
}

function networkErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Network error";
}
