import type { SiteConfig } from "@kody/shared";
import { streamChatCompletion, type ToolDefinition } from "./ai-provider.js";
import type { ToolExecutor } from "./tools/executor.js";
import { type ToolJobStore, type ToolJobStatus } from "./tool-job-store.js";
import { scrubOutput } from "./guardrails/output-scrubber.js";

export interface AgentCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onToolStart: (name: string, displayText: string) => void;
  onToolEnd: (name: string) => void;
  /**
   * Emitted while a long-running (async) tool is in flight. The UI
   * uses this to show a "Still working..." spinner with an
   * elapsed-time counter.
   */
  onToolProgress?: (info: {
    name: string;
    jobId: string;
    status: ToolJobStatus;
    progress?: number | null;
  }) => void;
  onSources?: (chunks: Array<{ title: string; url?: string; score: number }>) => void;
}

export interface AgentResult {
  content: string;
  toolCallsMade: number;
}

interface PollResponse {
  status?: string;
  progress?: number;
  result?: string;
  error?: string;
}

const TERMINAL_STATUSES: ReadonlyArray<ToolJobStatus> = ["succeeded", "failed", "timeout"];

function isTerminal(status: ToolJobStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.includes(status);
}

function normalizePollStatus(raw: string | undefined): ToolJobStatus {
  switch (raw) {
    case "succeeded":
    case "completed":
    case "done":
    case "finished":
      return "succeeded";
    case "failed":
    case "error":
      return "failed";
    case "timeout":
    case "timed_out":
      return "timeout";
    case "running":
    case "in_progress":
    case "active":
      return "running";
    default:
      return "pending";
  }
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "AbortError"
  );
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
  toolJobStore?: ToolJobStore;
  /**
   * Session id of the visitor whose turn we're running. Threaded
   * through to the tool_jobs row so the GET /api/tool-jobs/:jobId
   * endpoint can scope by session, not just by site.
   */
  sessionId?: string;
}): Promise<AgentResult> {
  const {
    config,
    messages,
    toolExecutor,
    tools,
    callbacks,
    scrubberConfig,
    signal,
    toolJobStore,
    sessionId,
  } = options;
  const maxCalls = config.tools.maxToolCalls;
  let totalToolCalls = 0;
  let fullContent = "";

  const workingMessages = [...messages];
  // Shared per-turn deadline for ALL async tool polls. The previous
  // implementation let each tool call use the full asyncMaxWaitMs
  // independently, which could blow the user's patience when the
  // agent decided to chain several async tools in one turn. The
  // individual `customTool.endpoint.asyncPollIntervalMs` controls
  // poll frequency; this controls total wall-clock for async work.
  const turnStart = Date.now();
  const asyncBudgetMs = config.tools.asyncMaxWaitMs ?? 30_000;
  const turnDeadline = turnStart + asyncBudgetMs;

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
        onRetry: ({ attempt, delayMs, reason }) => {
          // Surface retries to the chat as a debug-level info event.
          // The UI can show a subtle "reconnecting..." indicator.
          console.warn(
            `[agent] retrying AI call (attempt ${attempt}, +${delayMs}ms): ${reason}`,
          );
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

      const execResult = await toolExecutor.execute(toolCall, config, { sessionId });
      callbacks.onToolStart(execResult.name, execResult.displayText);

      // Async branch: poll the endpoint's poll URL until the job
      // reaches a terminal state, the per-turn deadline expires, or
      // the user aborts.
      let finalResult = execResult.result;
      if (execResult.async) {
        if (toolJobStore) {
          toolJobStore.update(
            execResult.async.jobId,
            { status: execResult.async.initialStatus },
            config.siteId,
          );
        }
        const polled = await pollAsyncTool({
          toolName: execResult.name,
          asyncInfo: execResult.async,
          toolJobStore,
          config,
          callbacks,
          signal,
          // Cap the per-call wait by both the per-call default
          // and the time left in the turn. This is what keeps a
          // chain of async tools from blowing the user's patience.
          deadlineMs: Math.max(0, turnDeadline - Date.now()),
        });
        finalResult = polled.result;
        // After polling completes, ensure the persisted row reflects
        // the final state.
        if (toolJobStore) {
          toolJobStore.update(
            execResult.async.jobId,
            {
              status: polled.status,
              result: polled.status === "succeeded" ? polled.result : null,
              errorMessage: polled.status !== "succeeded" ? polled.result : null,
            },
            config.siteId,
          );
        }
      }

      workingMessages.push({
        role: "tool",
        content: finalResult,
        tool_call_id: execResult.toolCallId,
      });

      callbacks.onToolEnd(execResult.name);
    }

    fullContent = "";
  }

  callbacks.onDone();
  return { content: fullContent, toolCallsMade: totalToolCalls };
}

interface PollOutcome {
  result: string;
  status: ToolJobStatus;
}

async function pollAsyncTool(opts: {
  toolName: string;
  asyncInfo: { jobId: string; pollUrl?: string; displayText: string; initialStatus: ToolJobStatus };
  toolJobStore?: ToolJobStore;
  config: SiteConfig;
  callbacks: AgentCallbacks;
  signal?: AbortSignal;
  /**
   * Wall-clock cap for this particular poll. The agent passes the
   * remaining per-turn budget so several async tools in one turn
   * share the budget rather than each spending the full cap.
   */
  deadlineMs?: number;
}): Promise<PollOutcome> {
  const { toolName, asyncInfo, toolJobStore, config, callbacks, signal } = opts;
  const perCallBudget = opts.deadlineMs ?? config.tools.asyncMaxWaitMs ?? 30_000;
  const deadline = Date.now() + perCallBudget;
  // The executor stored a row with `endpoint.asyncPollIntervalMs` (or
  // the customTool default), but since the agent doesn't see that
  // directly we re-read from the tool definition.
  const customTool = config.tools.customTools.find((t) => t.name === toolName);
  const pollIntervalMs = customTool?.endpoint.asyncPollIntervalMs ?? 2000;
  const pollUrl = asyncInfo.pollUrl;

  let lastStatus: ToolJobStatus = asyncInfo.initialStatus;
  let lastProgress: number | null = null;
  let lastError: string | null = null;
  let lastResult: string | null = null;
  // Tracks the most recent *successful* terminal status. If we hit
  // a network error after a terminal status arrived (e.g. a flaky
  // poll) we shouldn't clobber the success with a stale
  // errorMessage.
  let terminalReached = false;

  // Initial progress emit so the UI flips to "in progress" immediately
  callbacks.onToolProgress?.({
    name: toolName,
    jobId: asyncInfo.jobId,
    status: lastStatus,
    progress: lastProgress,
  });

  if (!pollUrl) {
    return {
      status: "failed",
      result: `Async tool "${toolName}" returned no pollUrl; cannot track job ${asyncInfo.jobId}.`,
    };
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      return { status: "timeout", result: "Aborted" };
    }
    if (Date.now() >= deadline) {
      return {
        status: "timeout",
        result: `Async tool "${toolName}" did not complete within ${perCallBudget}ms (last status: ${lastStatus}).`,
      };
    }

    await sleep(pollIntervalMs, signal);
    if (signal?.aborted) {
      return { status: "timeout", result: "Aborted" };
    }

    let pollResponse: Response;
    try {
      pollResponse = await fetch(pollUrl, {
        method: "GET",
        signal,
      });
    } catch (err) {
      if (isAbortError(err)) {
        return { status: "timeout", result: "Aborted" };
      }
      // Treat transient poll errors as "still running" — the agent
      // shouldn't fail the whole conversation just because a poll
      // hiccupped. We also clear `lastError` on success later so
      // a stale error doesn't leak into the persisted `errorMessage`.
      lastError = err instanceof Error ? err.message : "Poll error";
      continue;
    }

    let payload: PollResponse = {};
    try {
      const text = await pollResponse.text();
      payload = text ? (JSON.parse(text) as PollResponse) : {};
    } catch {
      // Bad JSON from the poll endpoint: keep polling.
      continue;
    }

    const newStatus = normalizePollStatus(payload.status);
    if (typeof payload.progress === "number") lastProgress = payload.progress;
    if (typeof payload.result === "string") lastResult = payload.result;
    const newError = typeof payload.error === "string" ? payload.error : null;
    lastStatus = newStatus;
    lastError = newError;
    if (isTerminal(newStatus)) {
      terminalReached = true;
    }

    // Compute the error to persist. We clear `errorMessage` on a
    // successful (non-terminal) poll so a transient fetch error
    // from the previous iteration doesn't leak into the row, and
    // we keep whatever the latest payload said on a terminal
    // status (which is what the row should report).
    const persistError = isTerminal(newStatus) ? newError : null;

    if (toolJobStore) {
      toolJobStore.update(
        asyncInfo.jobId,
        {
          status: lastStatus,
          progress: lastProgress,
          result: lastResult ?? undefined,
          errorMessage: persistError ?? undefined,
          touchPolledAt: true,
        },
        config.siteId,
      );
    }

    callbacks.onToolProgress?.({
      name: toolName,
      jobId: asyncInfo.jobId,
      status: lastStatus,
      progress: lastProgress,
    });

    if (isTerminal(lastStatus)) {
      if (lastStatus === "succeeded") {
        return {
          status: "succeeded",
          result: lastResult ?? "(async tool returned no result)",
        };
      }
      if (lastStatus === "failed") {
        return {
          status: "failed",
          result: lastError ?? "Async tool failed without an error message.",
        };
      }
      return {
        status: "timeout",
        result: lastError ?? "Async tool timed out.",
      };
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
