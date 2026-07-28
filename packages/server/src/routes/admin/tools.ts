import { Router, type Router as RouterType } from "express";
import type { SiteStore } from "../../services/site-store.js";
import { ToolExecutor } from "../../services/tools/executor.js";

const MAX_ARG_BYTES = 16 * 1024; // 16 KB cap on inbound arguments
const MAX_RESULT_BYTES = 10_000; // truncate responses at 10 KB on the wire

/**
 * Admin endpoints for trying out a site's tools.
 *
 * The executor is a fresh instance per request (no KnowledgeRetriever) —
 * the admin test surface only exercises the user-defined tool chain, never
 * the assistant's built-ins.
 */
export function createAdminToolsRouter(siteStore: SiteStore): RouterType {
  const router: RouterType = Router({ mergeParams: true });

  router.post("/:siteId/tools/:toolName/test", async (req, res) => {
    const { siteId, toolName } = req.params;
    const config = siteStore.getSiteConfig(siteId);
    if (!config) {
      res.status(404).json({ error: { message: "Site not found" } });
      return;
    }
    if (!config.tools.enabled) {
      res.status(400).json({ error: { message: "Tools are not enabled for this site" } });
      return;
    }

    const tool = config.tools.customTools.find((t) => t.name === toolName);
    if (!tool) {
      res.status(404).json({ error: { message: `Tool "${toolName}" not found` } });
      return;
    }

    const rawArgs = req.body?.arguments;
    if (rawArgs === undefined || rawArgs === null) {
      res.status(400).json({ error: { message: "Missing 'arguments' in request body" } });
      return;
    }
    if (typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
      res
        .status(400)
        .json({ error: { message: "'arguments' must be a JSON object" } });
      return;
    }
    const argString = JSON.stringify(rawArgs);
    if (argString.length > MAX_ARG_BYTES) {
      res.status(413).json({ error: { message: "Arguments too large" } });
      return;
    }

    const executor = new ToolExecutor(null);
    const result = await executor.execute(
      { id: `test-${Date.now()}`, function: { name: toolName, arguments: argString } },
      config,
    );

    const truncated = result.result.length > MAX_RESULT_BYTES;
    res.json({
      ok: result.ok,
      name: result.name,
      result: truncated ? result.result.slice(0, MAX_RESULT_BYTES) : result.result,
      truncated,
      displayText: result.displayText,
      tool: {
        name: tool.name,
        description: tool.description,
        endpoint: tool.endpoint.url,
        method: tool.endpoint.method,
      },
    });
  });

  return router;
}
