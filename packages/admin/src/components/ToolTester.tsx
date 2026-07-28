import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { testTool, type ToolTestResult } from "@/lib/api";

interface ToolTesterProps {
  siteId: string;
  tool: {
    name: string;
    description: string;
    endpoint: { url: string; method: string; headers?: Record<string, string> };
    parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  };
  onClose: () => void;
}

const SAMPLE_ARGS = '{\n  "example": "value"\n}';

/**
 * Modal that lets an admin run a single custom tool and see the response.
 *
 * Accessibility:
 *   - role="dialog" + aria-modal
 *   - Esc to close, focus traps inside the modal
 *   - First interactive element gets focus on mount
 *   - aria-live="polite" for the response region so screen readers
 *     announce the result.
 */
export function ToolTester({ siteId, tool, onClose }: ToolTesterProps) {
  const [argsText, setArgsText] = useState<string>(SAMPLE_ARGS);
  const [argsError, setArgsError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ToolTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"result" | "curl" | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  // Build a sensible initial arg template from the tool's parameter schema.
  useEffect(() => {
    const props = tool.parameters.properties || {};
    const initial: Record<string, unknown> = {};
    let hasAny = false;
    for (const [name, def] of Object.entries(props)) {
      hasAny = true;
      const t = (def as { type?: string }).type;
      if (t === "string") initial[name] = "";
      else if (t === "number" || t === "integer") initial[name] = 0;
      else if (t === "boolean") initial[name] = false;
      else initial[name] = null;
    }
    if (hasAny) setArgsText(JSON.stringify(initial, null, 2));
  }, [tool]);

  // Focus management: focus first button on mount, trap focus inside modal.
  useEffect(() => {
    firstButtonRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const parsedArgs = useMemo<Record<string, unknown> | null>(() => {
    if (!argsText.trim()) return {};
    try {
      const parsed = JSON.parse(argsText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [argsText]);

  const handleArgsChange = (text: string) => {
    setArgsText(text);
    if (!text.trim()) {
      setArgsError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setArgsError("Arguments must be a JSON object");
      } else {
        setArgsError(null);
      }
    } catch (err) {
      setArgsError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const run = useCallback(async () => {
    if (!parsedArgs) {
      setArgsError("Fix the arguments JSON before running");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await testTool(siteId, tool.name, parsedArgs);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tool test failed");
    } finally {
      setRunning(false);
    }
  }, [parsedArgs, siteId, tool.name]);

  const curlExample = useMemo(() => {
    const body = JSON.stringify({
      tool: tool.name,
      arguments: parsedArgs ?? {},
    });
    const lines = [
      `curl -X POST '${tool.endpoint.url}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${body.replace(/'/g, "'\\''")}'`,
    ];
    return lines.join("\n");
  }, [tool, parsedArgs]);

  const copy = async (text: string, kind: "result" | "curl") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard might be blocked; ignore silently.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-tester-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="tool-tester-title" className="text-lg font-semibold">
              Test tool: {tool.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tool.endpoint.method} {tool.endpoint.url}
            </p>
          </div>
          <button
            ref={firstButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close tool tester"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="tool-args" className="text-sm font-medium">
              Arguments (JSON)
            </label>
            <textarea
              id="tool-args"
              value={argsText}
              onChange={(e) => handleArgsChange(e.target.value)}
              rows={8}
              aria-invalid={argsError ? "true" : "false"}
              aria-describedby={argsError ? "tool-args-error" : "tool-args-help"}
              className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 ${
                argsError
                  ? "border-red-400 focus:ring-red-200"
                  : "border-border focus:ring-primary/25"
              }`}
              spellCheck={false}
            />
            {argsError ? (
              <p id="tool-args-error" className="mt-1 text-xs text-red-600">
                {argsError}
              </p>
            ) : (
              <p id="tool-args-help" className="mt-1 text-xs text-muted-foreground">
                Object body sent to the tool. Empty object is allowed.
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={run}
              disabled={running || argsError !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Running…" : "Run"}
            </button>
          </div>

          <div aria-live="polite" className="space-y-2">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              >
                {error}
              </div>
            )}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        result.ok ? "bg-green-500" : "bg-red-500"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-medium">
                      {result.ok ? "Success" : "Failed"}
                    </span>
                    {result.truncated && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        truncated to 10 KB
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(result.result, "result")}
                    className="rounded-md border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    {copied === "result" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre
                  className={`max-h-72 overflow-auto rounded-lg border px-3 py-2 font-mono text-xs ${
                    result.ok
                      ? "border-border bg-muted/30"
                      : "border-red-200 bg-red-50 dark:bg-red-950/30"
                  }`}
                >
                  {result.result}
                </pre>
              </div>
            )}
          </div>

          <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              Copy as curl
            </summary>
            <div className="mt-2 space-y-2">
              <pre className="max-h-48 overflow-auto rounded border border-border bg-background px-3 py-2 font-mono text-xs">
                {curlExample}
              </pre>
              <button
                type="button"
                onClick={() => copy(curlExample, "curl")}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                {copied === "curl" ? "Copied" : "Copy curl"}
              </button>
              <p className="text-xs text-muted-foreground">
                Use this to call the tool from outside the admin.
              </p>
            </div>
          </details>
        </div>

        <footer className="flex justify-end border-t border-border bg-muted/30 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
