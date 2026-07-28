import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

/**
 * Persisted state of a fire-and-poll custom tool call. Mirrors the
 * `tool_jobs` SQLite table. The server stores a row when an async
 * tool is dispatched, and the agent loop polls the row to decide
 * when to resume its tool call.
 */
export type ToolJobStatus = "pending" | "running" | "succeeded" | "failed" | "timeout";

export interface ToolJob {
  jobId: string;
  siteId: string;
  sessionId: string;
  toolName: string;
  endpointUrl: string;
  status: ToolJobStatus;
  progress: number | null;
  pollUrl: string | null;
  result: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  lastPolledAt: string | null;
  createdAt: string;
}

interface ToolJobRow {
  job_id: string;
  site_id: string;
  session_id: string;
  tool_name: string;
  endpoint_url: string;
  status: ToolJobStatus;
  progress: number | null;
  poll_url: string | null;
  result: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  last_polled_at: string | null;
  created_at: string;
}

function rowToJob(row: ToolJobRow): ToolJob {
  return {
    jobId: row.job_id,
    siteId: row.site_id,
    sessionId: row.session_id,
    toolName: row.tool_name,
    endpointUrl: row.endpoint_url,
    status: row.status,
    progress: row.progress,
    pollUrl: row.poll_url,
    result: row.result,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastPolledAt: row.last_polled_at,
    createdAt: row.created_at,
  };
}

export interface CreateToolJobInput {
  siteId: string;
  sessionId: string;
  toolName: string;
  endpointUrl: string;
  /** Optional poll URL the server should GET to check on the job. */
  pollUrl?: string;
  /**
   * Optional explicit job id. When the customer tool endpoint
   * returns a jobId in its 202 response, the executor passes it
   * through here so the stored row and the endpoint share the same
   * handle. If omitted, the store generates a UUID.
   */
  jobId?: string;
}

export interface ToolJobUpdate {
  status?: ToolJobStatus;
  progress?: number | null;
  result?: string | null;
  errorMessage?: string | null;
  pollUrl?: string | null;
  /** Touch the lastPolledAt timestamp without changing anything else. */
  touchPolledAt?: boolean;
}

export class ToolJobStore {
  constructor(private db: Database.Database) {}

  create(input: CreateToolJobInput): ToolJob {
    const jobId = input.jobId ?? randomUUID();
    this.db
      .prepare(
        `INSERT INTO tool_jobs (job_id, site_id, session_id, tool_name, endpoint_url, status, poll_url)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(jobId, input.siteId, input.sessionId, input.toolName, input.endpointUrl, input.pollUrl ?? null);
    const created = this.get(jobId);
    if (!created) {
      throw new Error("tool_jobs row not found immediately after insert");
    }
    return created;
  }

  get(jobId: string): ToolJob | null {
    const row = this.db
      .prepare("SELECT * FROM tool_jobs WHERE job_id = ?")
      .get(jobId) as ToolJobRow | undefined;
    return row ? rowToJob(row) : null;
  }

  /** Return the job only when it belongs to the supplied site (auth boundary). */
  getForSite(jobId: string, siteId: string): ToolJob | null {
    const row = this.db
      .prepare("SELECT * FROM tool_jobs WHERE job_id = ? AND site_id = ?")
      .get(jobId, siteId) as ToolJobRow | undefined;
    return row ? rowToJob(row) : null;
  }

  update(jobId: string, patch: ToolJobUpdate): ToolJob | null {
    const sets: string[] = [];
    const values: Array<string | number | null> = [];

    if (patch.status !== undefined) {
      sets.push("status = ?");
      values.push(patch.status);
      if (
        patch.status === "succeeded" ||
        patch.status === "failed" ||
        patch.status === "timeout"
      ) {
        sets.push("completed_at = datetime('now')");
      }
    }
    if (patch.progress !== undefined) {
      sets.push("progress = ?");
      values.push(patch.progress);
    }
    if (patch.result !== undefined) {
      sets.push("result = ?");
      values.push(patch.result);
    }
    if (patch.errorMessage !== undefined) {
      sets.push("error_message = ?");
      values.push(patch.errorMessage);
    }
    if (patch.pollUrl !== undefined) {
      sets.push("poll_url = ?");
      values.push(patch.pollUrl);
    }
    if (patch.touchPolledAt) {
      sets.push("last_polled_at = datetime('now')");
    }
    if (sets.length === 0) return this.get(jobId);

    values.push(jobId);
    this.db
      .prepare(`UPDATE tool_jobs SET ${sets.join(", ")} WHERE job_id = ?`)
      .run(...values);
    return this.get(jobId);
  }

  /**
   * Drop a job (operator/admin cleanup). Returns the number of rows
   * deleted.
   */
  delete(jobId: string): number {
    const result = this.db.prepare("DELETE FROM tool_jobs WHERE job_id = ?").run(jobId);
    return result.changes;
  }

  /**
   * Drop every job for a site. Used by site deletion and tests.
   */
  deleteForSite(siteId: string): number {
    const result = this.db.prepare("DELETE FROM tool_jobs WHERE site_id = ?").run(siteId);
    return result.changes;
  }

  /**
   * Drop every job in the table — intended for tests and ops scripts.
   */
  deleteAll(): number {
    const result = this.db.prepare("DELETE FROM tool_jobs").run();
    return result.changes;
  }

  list(opts: { siteId?: string; sessionId?: string; status?: ToolJobStatus } = {}): ToolJob[] {
    const where: string[] = [];
    const values: Array<string> = [];
    if (opts.siteId) {
      where.push("site_id = ?");
      values.push(opts.siteId);
    }
    if (opts.sessionId) {
      where.push("session_id = ?");
      values.push(opts.sessionId);
    }
    if (opts.status) {
      where.push("status = ?");
      values.push(opts.status);
    }
    const sql =
      "SELECT * FROM tool_jobs" +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      " ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all(...values) as ToolJobRow[];
    return rows.map(rowToJob);
  }
}
