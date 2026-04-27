import type { EnrichedKnowledgeSource } from "./index.js";

export interface Chunk {
  content: string;
  metadata: {
    sourceIndex: number;
    sourceType: string;
    chunkIndex: number;
    title?: string;
    url?: string;
    question?: string;
  };
}

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

function splitText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  if (text.length <= chunkSize) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (current.length + sentence.length + 1 > chunkSize && current) {
          chunks.push(current.trim());
          const overlapStart = Math.max(0, current.length - chunkOverlap);
          current = current.slice(overlapStart) + " " + sentence;
        } else {
          current = current ? current + " " + sentence : sentence;
        }
      }
    } else if (current.length + para.length + 2 > chunkSize && current) {
      chunks.push(current.trim());
      const overlapStart = Math.max(0, current.length - chunkOverlap);
      current = current.slice(overlapStart) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function chunkKnowledgeSources(
  sources: EnrichedKnowledgeSource[],
  options: ChunkOptions,
): Chunk[] {
  const { chunkSize, chunkOverlap } = options;
  const chunks: Chunk[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];

    switch (source.type) {
      case "text": {
        const parts = splitText(source.content, chunkSize, chunkOverlap);
        for (let j = 0; j < parts.length; j++) {
          chunks.push({
            content: parts[j],
            metadata: {
              sourceIndex: i,
              sourceType: "text",
              chunkIndex: j,
              title: source.title,
            },
          });
        }
        break;
      }

      case "faq": {
        for (let j = 0; j < source.entries.length; j++) {
          const entry = source.entries[j];
          chunks.push({
            content: `Q: ${entry.question}\nA: ${entry.answer}`,
            metadata: {
              sourceIndex: i,
              sourceType: "faq",
              chunkIndex: j,
              question: entry.question,
            },
          });
        }
        break;
      }

      case "url": {
        if (!source.fetchedContent) break;
        const parts = splitText(source.fetchedContent, chunkSize, chunkOverlap);
        for (let j = 0; j < parts.length; j++) {
          chunks.push({
            content: parts[j],
            metadata: {
              sourceIndex: i,
              sourceType: "url",
              chunkIndex: j,
              title: source.title,
              url: source.url,
            },
          });
        }
        break;
      }

      case "file": {
        if (!source.fetchedContent) break;
        const parts = splitText(source.fetchedContent, chunkSize, chunkOverlap);
        for (let j = 0; j < parts.length; j++) {
          chunks.push({
            content: parts[j],
            metadata: {
              sourceIndex: i,
              sourceType: "file",
              chunkIndex: j,
              title: source.title ?? source.filePath,
            },
          });
        }
        break;
      }
    }
  }

  return chunks;
}
