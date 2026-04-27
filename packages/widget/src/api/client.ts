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
  };
  tickets: {
    enabled: boolean;
    promptMessage: string;
    requiredFields: string[];
  };
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
  | { type: "sources"; chunks: Array<{ title: string; url?: string; score: number }> };

export class KodyApiClient {
  constructor(
    private baseUrl: string,
    private siteId: string,
  ) {}

  async fetchConfig(): Promise<PublicSiteConfig> {
    const res = await fetch(`${this.baseUrl}/api/config/${this.siteId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch config: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<PublicSiteConfig>;
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
        headers: {
          "Content-Type": "application/json",
          "x-kody-site-id": this.siteId,
        },
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
