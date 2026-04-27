import type { AiProviderConfig } from "@kody/shared";

const BATCH_SIZE = 32;
const TIMEOUT_MS = 30_000;

export interface EmbeddingService {
  embed(texts: string[]): Promise<Float32Array[]>;
  dimensions(): number;
  isAvailable(): Promise<boolean>;
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
}

export function createEmbeddingService(
  aiConfig: AiProviderConfig,
  embeddingModel?: string,
): EmbeddingService {
  const model = embeddingModel ?? aiConfig.model;
  const baseUrl = aiConfig.baseUrl.replace(/\/+$/, "");
  let cachedDimensions = 0;
  let availabilityChecked = false;
  let available = false;

  async function callEmbeddings(input: string[]): Promise<Float32Array[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({ model, input }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Embeddings API returned ${response.status}`);
      }

      const json = (await response.json()) as EmbeddingResponse;
      const sorted = json.data.sort((a, b) => a.index - b.index);
      return sorted.map((d) => new Float32Array(d.embedding));
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async embed(texts: string[]): Promise<Float32Array[]> {
      if (texts.length === 0) return [];

      const results: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const embeddings = await callEmbeddings(batch);
        results.push(...embeddings);

        if (cachedDimensions === 0 && embeddings.length > 0) {
          cachedDimensions = embeddings[0].length;
        }
      }
      return results;
    },

    dimensions(): number {
      return cachedDimensions;
    },

    async isAvailable(): Promise<boolean> {
      if (availabilityChecked) return available;

      try {
        const result = await callEmbeddings(["test"]);
        available = result.length > 0;
        if (available) {
          cachedDimensions = result[0].length;
        }
      } catch {
        available = false;
      }

      availabilityChecked = true;
      return available;
    },
  };
}
