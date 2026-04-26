import { readFileSync } from "node:fs";
import { resolve, normalize } from "node:path";

const MAX_CONTENT_LENGTH = 50_000;
const DEFAULT_BASE_DIR = resolve("knowledge-files");

export function readKnowledgeFile(
  filePath: string,
  baseDir: string = DEFAULT_BASE_DIR,
): string | null {
  if (filePath.includes("..")) {
    return null;
  }

  const resolved = resolve(baseDir, filePath);
  const normalizedBase = normalize(baseDir);

  if (!resolved.startsWith(normalizedBase)) {
    return null;
  }

  try {
    let content = readFileSync(resolved, "utf-8");
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH);
    }
    return content;
  } catch {
    return null;
  }
}
