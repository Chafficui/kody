import { DEFAULT_BLOCKED_INPUT_PATTERNS } from "@kody/shared";

export interface InputFilterConfig {
  maxInputLength: number;
  blockedInputPatterns: string[];
  enablePromptInjectionDetection: boolean;
}

export interface InputFilterResult {
  allowed: boolean;
  reason?: string;
}

const ZERO_WIDTH_CHARS = /[​‌‍﻿­⁠᠎]/g;

const HOMOGLYPH_MAP: Record<string, string> = {
  а: "a", // Cyrillic а
  е: "e", // Cyrillic е
  о: "o", // Cyrillic о
  р: "p", // Cyrillic р
  с: "c", // Cyrillic с
  у: "y", // Cyrillic у
  х: "x", // Cyrillic х
  і: "i", // Cyrillic і
  ј: "j", // Cyrillic ј
  һ: "h", // Cyrillic һ
  ԁ: "d", // Cyrillic ԁ
  ԛ: "q", // Cyrillic ԛ
  ԝ: "w", // Cyrillic ԝ
};

function normalizeUnicode(text: string): string {
  let normalized = text.replace(ZERO_WIDTH_CHARS, "");

  for (const [homoglyph, replacement] of Object.entries(HOMOGLYPH_MAP)) {
    normalized = normalized.replaceAll(homoglyph, replacement);
  }

  return normalized;
}

export function filterInput(rawMessage: string, config: InputFilterConfig): InputFilterResult {
  const message = normalizeUnicode(rawMessage);
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { allowed: false, reason: "Empty message" };
  }

  if (trimmed.length > config.maxInputLength) {
    return { allowed: false, reason: `Message exceeds maximum length of ${config.maxInputLength}` };
  }

  if (config.enablePromptInjectionDetection) {
    for (const pattern of DEFAULT_BLOCKED_INPUT_PATTERNS) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(message)) {
          return { allowed: false, reason: "Potential prompt injection detected" };
        }
      } catch {
        continue;
      }
    }
  }

  for (const pattern of config.blockedInputPatterns) {
    try {
      const regex = new RegExp(pattern, "i");
      if (regex.test(message)) {
        return { allowed: false, reason: "Message matches a blocked pattern" };
      }
    } catch {
      continue;
    }
  }

  return { allowed: true };
}
