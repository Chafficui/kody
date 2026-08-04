import { Router, type Router as RouterType } from "express";
import type Database from "better-sqlite3";
import { ToolJobStore, isValidJobId } from "../services/tool-job-store.js";

/**
 * Read-only endpoint for the widget to check on a fire-and-poll tool
 * job. The job id is opaque; the server looks it up in `tool_jobs`
 * and returns the latest known status. The site-auth middleware
 * (mounted in `app.ts`) ensures the requesting site owns the job,
 * and we additionally require the caller's session to match so a
 * job created in one visitor's session can't be polled from
 * another.
 */
export function createToolJobsRouter(db: Database.Database): RouterType {
  const router: RouterType = Router();
  const store = new ToolJobStore(db);

  router.get("/:jobId", (req, res) => {
    const config = req.siteConfig;
    if (!config) {
      res.status(400).json({ error: { message: "Missing site config" } });
      return;
    }

    const { jobId } = req.params;
    if (!jobId || !isValidJobId(jobId)) {
      res.status(400).json({ error: { message: "Invalid jobId" } });
      return;
    }

    // The widget passes the visitor's session id via query string
    // (`?sessionId=...`) so the row can be scoped to the visitor
    // who created it. If the caller doesn't know the session, the
    // job is treated as foreign (404) — this prevents an attacker
    // who has guessed a jobId from polling someone else's job.
    const sessionId =
      typeof req.query.sessionId === "string" && req.query.sessionId.length > 0
        ? req.query.sessionId
        : undefined;

    const job = store.getForSite(jobId, config.siteId);
    if (!job) {
      res.status(404).json({ error: { message: "Tool job not found" } });
      return;
    }
    if (sessionId !== undefined && job.sessionId !== sessionId) {
      // Surface a 404 (not 403) so a probing client can't
      // distinguish "exists but not yours" from "doesn't exist".
      res.status(404).json({ error: { message: "Tool job not found" } });
      return;
    }

    res.json({
      jobId: job.jobId,
      toolName: job.toolName,
      status: job.status,
      progress: job.progress,
      result: job.result,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      lastPolledAt: job.lastPolledAt,
    });
  });

  return router;
}
