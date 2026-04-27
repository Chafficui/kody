import type { SiteConfig } from "@kody/shared";
import { streamChatCompletion, type ToolDefinition } from "./ai-provider.js";
import type { ToolExecutor } from "./tools/executor.js";
import { scrubOutput } from "./guardrails/output-scrubber.js";

export interface AgentCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onToolStart: (name: string, displayText: string) => void;
  onToolEnd: (name: string) => void;
  onSources?: (chunks: Array<{ title: string; url?: string; score: number }>) => void;
}

export interface AgentResult {
  content: string;
  toolCallsMade: number;
}

export async function runAgent(options: {
  config: SiteConfig;
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }>;
  toolExecutor: ToolExecutor;
  tools: ToolDefinition[];
  callbacks: AgentCallbacks;
  scrubberConfig: {
    assistantName: string;
    enableOutputScrubbing: boolean;
    blockedOutputPatterns: string[];
    systemPromptFragments: string[];
  };
  signal?: AbortSignal;
}): Promise<AgentResult> {
  const { config, messages, toolExecutor, tools, callbacks, scrubberConfig, signal } = options;
  const maxCalls = config.tools.maxToolCalls;
  let totalToolCalls = 0;
  let fullContent = "";

  const workingMessages = [...messages];

  while (totalToolCalls <= maxCalls) {
    const result = await streamChatCompletion(
      config.ai,
      workingMessages,
      {
        onToken: (token) => {
          const scrubbed = scrubOutput(token, scrubberConfig);
          if (!scrubbed.blocked) {
            fullContent += scrubbed.content;
            callbacks.onToken(scrubbed.content);
          }
        },
        onDone: () => {},
        onError: (error) => {
          callbacks.onError(error);
        },
      },
      { tools, signal },
    );

    if (result.finishReason === "error") {
      return { content: fullContent, toolCallsMade: totalToolCalls };
    }

    if (result.toolCalls.length === 0 || result.finishReason !== "tool_calls") {
      callbacks.onDone();
      return { content: fullContent, toolCallsMade: totalToolCalls };
    }

    workingMessages.push({
      role: "assistant",
      content: result.content || "",
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });

    for (const toolCall of result.toolCalls) {
      totalToolCalls++;
      if (totalToolCalls > maxCalls) break;

      const execResult = await toolExecutor.execute(toolCall, config);
      callbacks.onToolStart(execResult.name, execResult.displayText);

      workingMessages.push({
        role: "tool",
        content: execResult.result,
        tool_call_id: execResult.toolCallId,
      });

      callbacks.onToolEnd(execResult.name);
    }

    fullContent = "";
  }

  callbacks.onDone();
  return { content: fullContent, toolCallsMade: totalToolCalls };
}
