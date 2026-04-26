export interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  meta?: string;
}

const MAX_ENTRIES = 500;

class LogStore {
  private entries: LogEntry[] = [];
  private nextId = 1;
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  install(): void {
    console.log = (...args: unknown[]) => {
      this.push("info", args);
      this.originalConsole.log(...args);
    };
    console.warn = (...args: unknown[]) => {
      this.push("warn", args);
      this.originalConsole.warn(...args);
    };
    console.error = (...args: unknown[]) => {
      this.push("error", args);
      this.originalConsole.error(...args);
    };
  }

  private push(level: LogEntry["level"], args: unknown[]): void {
    const message = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");

    const meta = args.length > 1 && typeof args[args.length - 1] === "object"
      ? JSON.stringify(args[args.length - 1])
      : undefined;

    this.entries.push({
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    });

    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
  }

  getEntries(options?: { level?: string; since?: number; limit?: number }): LogEntry[] {
    let result = this.entries;

    if (options?.level) {
      result = result.filter((e) => e.level === options.level);
    }
    if (options?.since != null) {
      const since = options.since;
      result = result.filter((e) => e.id > since);
    }

    const limit = options?.limit ?? 200;
    return result.slice(-limit);
  }

  clear(): void {
    this.entries = [];
  }
}

export const logStore = new LogStore();
