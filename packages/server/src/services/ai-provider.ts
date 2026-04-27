import type { AiProviderConfig } from "@kody/shared";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallRequest {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface AiStreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export interface AiStreamResult {
  content: string;
  toolCalls: ToolCallRequest[];
  finishReason: string;
}

export async function streamChatCompletion(
  config: AiProviderConfig,
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }>,
  callbacks: AiStreamCallbacks,
  options?: { tools?: ToolDefinition[]; signal?: AbortSignal },
): Promise<AiStreamResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey && config.apiKey !== "ollama") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    ...(config.topP !== undefined ? { top_p: config.topP } : {}),
  };

  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options?.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect to AI provider";
    callbacks.onError(message);
    return { content: "", toolCalls: [], finishReason: "error" };
  }

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "Unknown error");
    callbacks.onError(`AI provider returned ${response.status}: ${responseBody}`);
    return { content: "", toolCalls: [], finishReason: "error" };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body from AI provider");
    return { content: "", toolCalls: [], finishReason: "error" };
  }

  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";
  let finishReason = "stop";
  const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

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
            const toolCalls = buildToolCalls(toolCallAccumulator);
            callbacks.onDone();
            return { content: fullContent, toolCalls, finishReason };
          }
          continue;
        }

        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const choice = json.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          if (delta?.content) {
            fullContent += delta.content;
            callbacks.onToken(delta.content);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallAccumulator.has(idx)) {
                toolCallAccumulator.set(idx, {
                  id: tc.id ?? "",
                  name: tc.function?.name ?? "",
                  arguments: "",
                });
              }
              const acc = toolCallAccumulator.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments) acc.arguments += tc.function.arguments;
            }
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
            if (
              choice.finish_reason === "stop" ||
              choice.finish_reason === "tool_calls"
            ) {
              const toolCalls = buildToolCalls(toolCallAccumulator);
              callbacks.onDone();
              return { content: fullContent, toolCalls, finishReason };
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const toolCalls = buildToolCalls(toolCallAccumulator);
  callbacks.onDone();
  return { content: fullContent, toolCalls, finishReason };
}

function buildToolCalls(
  acc: Map<number, { id: string; name: string; arguments: string }>,
): ToolCallRequest[] {
  if (acc.size === 0) return [];
  return Array.from(acc.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => ({
      id: v.id,
      function: { name: v.name, arguments: v.arguments },
    }));
}
