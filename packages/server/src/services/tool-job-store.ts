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

/**
 * Hard cap on the externally-supplied `jobId` to keep the
 * `(site_id, job_id)` unique index small and to bound what the
 * GET /api/tool-jobs/:jobId route has to look up. Matches the
 * 128-char limit in the route handler.
 */
const MAX_JOB_ID_LENGTH = 128;
/** Default cap for `list` so admin scripts can pull a bounded page. */
const DEFAULT_LIST_LIMIT = 200;
/** Hard cap on `list` so a buggy caller can't dump the whole table. */
const MAX_LIST_LIMIT = 1000;

/**
 * Reject job ids that don't look like a reasonable opaque token. We
 * intentionally allow most printable ASCII (the customer tool
 * endpoint can return anything from a UUID to a base64 blob) but
 * keep length bounded and forbid whitespace so the value is safe to
 * drop into a URL path and a SQLite text column.
 */
export function isValidJobId(value: string): boolean {
  if (value.length === 0 || value.length > MAX_JOB_ID_LENGTH) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    // Disallow whitespace and control characters; allow everything else.
    if (c <= 0x20 || c === 0x7f) return false;
  }
  return true;
}

export class ToolJobStore {
  constructor(private db: Database.Database) {}

  create(input: CreateToolJobInput): ToolJob {
    let jobId = input.jobId ?? randomUUID();
    if (input.jobId !== undefined && !isValidJobId(input.jobId)) {
      throw new Error(`Invalid jobId format: ${input.jobId.slice(0, 32)}…`);
    }
    if (jobId.length > MAX_JOB_ID_LENGTH) jobId = jobId.slice(0, MAX_JOB_ID_LENGTH);
    this.db
      .prepare(
        `INSERT INTO tool_jobs (job_id, site_id, session_id, tool_name, endpoint_url, status, poll_url)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(jobId, input.siteId, input.sessionId, input.toolName, input.endpointUrl, input.pollUrl ?? null);
    const created = this.getForSite(jobId, input.siteId);
    if (!created) {
      throw new Error("tool_jobs row not found immediately after insert");
    }
    return created;
  }

  /**
   * Look up a job by its external id. Job ids are unique only
   * within a site, so callers that know the requesting site should
   * prefer `getForSite` to avoid a cross-site enumeration vector.
   * Callers that *do not* know the site should also be careful:
   * the unscoped lookup returns the *first* row matching the
   * jobId, which on a collision is whichever site happened to
   * land first in the index — almost certainly a bug.
   */
  get(jobId: string): ToolJob | null {
    const row = this.db
      .prepare("SELECT * FROM tool_jobs WHERE job_id = ?")
      .get(jobId) as ToolJobRow | undefined;
    return row ? rowToJob(row) : null;
  }

  /**
   * Return the job only when it belongs to the supplied site.
   * This is the auth-boundary lookup used by every request
   * handler — the unique index is `(site_id, job_id)`, so
   * collision across sites is impossible. Prefer this over
   * the unscoped `get` whenever the calling site is known.
   */
  getForSite(jobId: string, siteId: string): ToolJob | null {
    const row = this.db
      .prepare("SELECT * FROM tool_jobs WHERE site_id = ? AND job_id = ?")
      .get(siteId, jobId) as ToolJobRow | undefined;
    return row ? rowToJob(row) : null;
  }

  /**
   * Apply a partial update to a job row. `siteId` is **mandatory**:
   * the SQL is constrained by both `site_id` and `job_id` so a
   * caller can only ever mutate a row that belongs to its own
   * site. Returns the updated row, or `null` when no such
   * (site, job) exists.
   *
   * The site-scoped path is the only update path. The previous
   * implementation also accepted an unscoped update (looking up
   * the job by `job_id` alone), which would let a caller with a
   * guessed `jobId` mutate a row owned by a different site — a
   * cross-site write. Removing the unscoped branch closes that
   * hole; the `get` method above remains for read-only callers
   * that genuinely have no site context (currently none — kept
   * for tests / future use).
   */
  update(jobId: string, patch: ToolJobUpdate, siteId: string): ToolJob | null {
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
    if (sets.length === 0) {
      return this.getForSite(jobId, siteId);
    }

    values.push(siteId, jobId);
    this.db
      .prepare(`UPDATE tool_jobs SET ${sets.join(", ")} WHERE site_id = ? AND job_id = ?`)
      .run(...values);
    return this.getForSite(jobId, siteId);
  }

  /**
   * Drop a job (operator/admin cleanup). Returns the number of rows
   * deleted. Prefer `deleteForSite` whenever the site is known —
   * the unscoped delete would remove every site that happened to
   * share a `jobId`, which on the unique index is never more than
   * one, but the unscoped form is still risky to keep around.
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

  /**
   * List jobs with optional filters. Always appends a bounded
   * `LIMIT` (default 200, max 1000) so a buggy caller can't pull
   * the whole table into memory.
   */
  list(
    opts: {
      siteId?: string;
      sessionId?: string;
      status?: ToolJobStatus;
      limit?: number;
    } = {},
  ): ToolJob[] {
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
    const requested = opts.limit ?? DEFAULT_LIST_LIMIT;
    const limit = Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(requested)));
    const sql =
      "SELECT * FROM tool_jobs" +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      " ORDER BY created_at DESC LIMIT ?";
    const rows = this.db.prepare(sql).all(...values, limit) as ToolJobRow[];
    return rows.map(rowToJob);
  }

  /**
   * Retention sweep: drop terminal jobs older than `maxAgeMs`.
   * `terminal` means `succeeded`, `failed`, or `timeout`. Pending /
   * running rows are left alone so we don't lose track of a
   * long-running tool.
   *
   * Returns the number of rows deleted. Called by the server
   * bootstrap (rare) and by a slow interval from
   * `app.ts` so the table doesn't grow without bound.
   */
  pruneTerminal(maxAgeMs: number): number {
    const cutoffSeconds = Math.max(0, Math.floor(maxAgeMs / 1000));
    const result = this.db
      .prepare(
        `DELETE FROM tool_jobs
         WHERE status IN ('succeeded', 'failed', 'timeout')
           AND completed_at IS NOT NULL
           AND (julianday('now') - julianday(completed_at)) * 86400 > ?`,
      )
      .run(cutoffSeconds);
    return result.changes;
  }
}
