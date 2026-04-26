import type { AiProviderConfig, ChatMessage } from "@kody/shared";

export interface AiStreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function streamChatCompletion(
  config: AiProviderConfig,
  messages: Array<{ role: string; content: string }>,
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey && config.apiKey !== "ollama") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        ...(config.topP !== undefined ? { top_p: config.topP } : {}),
      }),
      signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect to AI provider";
    callbacks.onError(message);
    return "";
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    callbacks.onError(`AI provider returned ${response.status}: ${body}`);
    return "";
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body from AI provider");
    return "";
  }

  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") {
          if (trimmed === "data: [DONE]") {
            callbacks.onDone();
            return fullContent;
          }
          continue;
        }

        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            callbacks.onToken(delta);
          }

          if (json.choices?.[0]?.finish_reason === "stop") {
            callbacks.onDone();
            return fullContent;
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  callbacks.onDone();
  return fullContent;
}
