import { Router, type Router as RouterType } from "express";
import type Database from "better-sqlite3";
import { ToolJobStore, isValidJobId } from "../services/tool-job-store.js";

/**
 * Read-only endpoint for the widget to check on a fire-and-poll tool
 * job. The job id is opaque; the server looks it up in `tool_jobs`
 * and returns the latest known status. The site-auth middleware
 * (mounted in `app.ts`) ensures the requesting site owns the job,
 * and we additionally require a non-empty `?sessionId=...` query
 * parameter that matches the row's stored `sessionId`. A missing
 * or empty `sessionId` short-circuits to 404 (before the
 * `getForSite` lookup) so a probing client without the session
 * cannot get past the auth gate at all, and a present-but-mismatched
 * `sessionId` 404s after the lookup so "exists but not yours" is
 * indistinguishable from "doesn't exist".
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
    // who created it. A missing or empty `sessionId` is treated
    // as a foreign-session probe and 404s immediately — without
    // this, a request with no `sessionId` would skip the
    // session-mismatch check below and the row's stored
    // `sessionId` would be returned to anyone who could guess
    // the `jobId`. Enforce the non-empty contract up front so
    // the only way past the gate is a `sessionId` that actually
    // has to match.
    const sessionId =
      typeof req.query.sessionId === "string" && req.query.sessionId.length > 0
        ? req.query.sessionId
        : undefined;

    if (!sessionId) {
      // Intentionally indistinguishable from "no such job" so
      // a probing client can't tell whether the omission is
      // the reason for the 404 (it should be — but the
      // response shape stays uniform with the existing
      // mismatch path).
      res.status(404).json({ error: { message: "Tool job not found" } });
      return;
    }

    const job = store.getForSite(jobId, config.siteId);
    if (!job) {
      res.status(404).json({ error: { message: "Tool job not found" } });
      return;
    }
    if (job.sessionId !== sessionId) {
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
