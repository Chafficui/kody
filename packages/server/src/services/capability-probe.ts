import type { AiProviderConfig } from "@kody/shared";

interface Capabilities {
  supportsTools: boolean;
  supportsEmbeddings: boolean;
  checkedAt: number;
}

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, Capabilities>();

function cacheKey(config: AiProviderConfig): string {
  return `${config.baseUrl}|${config.model}`;
}

export async function probeCapabilities(config: AiProviderConfig): Promise<Capabilities> {
  const key = cacheKey(config);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.checkedAt < TTL_MS) return cached;

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey && config.apiKey !== "ollama") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  let supportsTools = false;
  let supportsEmbeddings = false;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "test" }],
        tools: [
          {
            type: "function",
            function: {
              name: "test_probe",
              description: "test",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    supportsTools = res.ok;
  } catch {
    supportsTools = false;
  }

  try {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: config.model, input: ["test"] }),
      signal: AbortSignal.timeout(10_000),
    });
    supportsEmbeddings = res.ok;
  } catch {
    supportsEmbeddings = false;
  }

  const result = { supportsTools, supportsEmbeddings, checkedAt: Date.now() };
  cache.set(key, result);
  return result;
}
