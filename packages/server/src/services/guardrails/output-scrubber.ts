export interface OutputScrubberConfig {
  assistantName: string;
  enableOutputScrubbing: boolean;
  blockedOutputPatterns: string[];
  systemPromptFragments: string[];
}

export interface ScrubResult {
  content: string;
  blocked: boolean;
  reason?: string;
}

function detectSystemPromptLeak(text: string, fragments: string[]): boolean {
  const lowerText = text.toLowerCase();

  for (const fragment of fragments) {
    if (fragment.length < 20) continue;

    const lowerFragment = fragment.toLowerCase();
    if (lowerText.includes(lowerFragment)) {
      return true;
    }
  }

  return false;
}

export function scrubOutput(text: string, config: OutputScrubberConfig): ScrubResult {
  if (!config.enableOutputScrubbing) {
    return { content: text, blocked: false };
  }

  if (text.length === 0) {
    return { content: text, blocked: false };
  }

  if (detectSystemPromptLeak(text, config.systemPromptFragments)) {
    return {
      content: "",
      blocked: true,
      reason: "Response contained system prompt information",
    };
  }

  for (const pattern of config.blockedOutputPatterns) {
    try {
      const regex = new RegExp(pattern, "i");
      if (regex.test(text)) {
        return {
          content: "",
          blocked: true,
          reason: "Response matched a blocked output pattern",
        };
      }
    } catch {
      continue;
    }
  }

  return { content: text, blocked: false };
}
