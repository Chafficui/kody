import { Router, type Router as RouterType } from "express";
import type Database from "better-sqlite3";
import { ToolJobStore } from "../services/tool-job-store.js";

/**
 * Read-only endpoint for the widget to check on a fire-and-poll tool
 * job. The job id is opaque; the server looks it up in `tool_jobs`
 * and returns the latest known status. The site-auth middleware
 * (mounted in `app.ts`) ensures the requesting site owns the job.
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
    if (!jobId || jobId.length > 128) {
      res.status(400).json({ error: { message: "Invalid jobId" } });
      return;
    }

    const job = store.getForSite(jobId, config.siteId);
    if (!job) {
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
