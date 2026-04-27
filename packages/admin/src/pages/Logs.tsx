import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLogs, clearLogs } from "@/lib/api";

interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  message: string;
}

const LEVEL_STYLES: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const POLL_INTERVAL = 3000;

export default function LogsPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchLogs({
        since: lastIdRef.current,
        limit: 500,
      });
      if (data.entries.length > 0) {
        setEntries((prev) => {
          const merged = [...prev, ...data.entries];
          return merged.length > 500 ? merged.slice(-500) : merged;
        });
        lastIdRef.current = data.entries[data.entries.length - 1].id;
      }
    } catch {
      // silently retry on next poll
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load, paused]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const handleClear = async () => {
    await clearLogs();
    setEntries([]);
    lastIdRef.current = 0;
  };

  const filtered = filter === "all" ? entries : entries.filter((e) => e.level === filter);

  const counts = {
    all: entries.length,
    info: entries.filter((e) => e.level === "info").length,
    warn: entries.filter((e) => e.level === "warn").length,
    error: entries.filter((e) => e.level === "error").length,
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Server Logs</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border">
            {(["all", "info", "warn", "error"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFilter(level)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === level
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                } ${level === "all" ? "rounded-l-lg" : ""} ${level === "error" ? "rounded-r-lg" : ""}`}
              >
                {level} ({counts[level]})
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              paused
                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {paused ? "Paused" : "Live"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto rounded-lg border border-border bg-[#0d1117] font-mono text-xs"
      >
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {paused ? "Polling paused" : "No log entries yet"}
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="whitespace-nowrap px-3 py-1 text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td
                    className={`w-14 px-2 py-1 font-semibold uppercase ${LEVEL_STYLES[entry.level] ?? "text-foreground"}`}
                  >
                    {entry.level}
                  </td>
                  <td className="whitespace-pre-wrap break-all px-3 py-1 text-[#e6edf3]">
                    {entry.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-8 right-8 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
