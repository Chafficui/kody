import { Router, type Router as RouterType } from "express";
import type { SiteStore } from "../../services/site-store.js";
import type { ToolExecutor } from "../../services/tools/executor.js";
import type { CustomTool } from "@kody/shared";
import { customToolSchema } from "@kody/shared";

const MAX_ARG_BYTES = 16 * 1024; // 16 KB cap on inbound arguments
const MAX_RESULT_BYTES = 10_000; // truncate responses at 10 KB on the wire

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: false });

/**
 * Truncate a string so that its UTF-8 encoding does not exceed `maxBytes`.
 * The cut is performed on byte boundaries and the partial multi-byte
 * character at the end is dropped so we never emit a broken code point.
 */
function truncateUtf8(text: string, maxBytes: number): string {
  const encoded = textEncoder.encode(text);
  if (encoded.byteLength <= maxBytes) return text;
  // Walk backwards from the limit to drop any partial trailing UTF-8 byte
  // sequence. A UTF-8 continuation byte is in the 0x80–0xBF range, so we
  // stop at the first non-continuation byte at or before the cut.
  let cut = maxBytes;
  while (cut > 0 && (encoded[cut] & 0xc0) === 0x80) {
    cut -= 1;
  }
  return textDecoder.decode(encoded.subarray(0, cut));
}

/**
 * Admin endpoints for trying out a site's tools.
 *
 * The executor is shared with the application so any in-process tools
 * registered at startup (via `Toolkit.export()` → `executor.getRegistry()`)
 * are available here — only the `KnowledgeRetriever` is omitted, so the
 * admin test surface exercises the user-defined tool chain without the
 * assistant's built-ins.
 */
export function createAdminToolsRouter(
  siteStore: SiteStore,
  toolExecutor: ToolExecutor,
): RouterType {
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

    // Prefer the tool definition provided in the request body — that lets
    // the admin test a draft (unsaved) configuration. Fall back to the
    // saved customTools entry for back-compat.
    const draftTool = req.body?.tool;
    let tool: CustomTool | undefined;
    if (draftTool && typeof draftTool === "object") {
      const parsed = customToolSchema.safeParse(draftTool);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            message: `Invalid tool draft: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
          },
        });
        return;
      }
      tool = parsed.data as CustomTool;
    } else {
      tool = config.tools.customTools.find((t) => t.name === toolName);
      if (!tool) {
        res.status(404).json({ error: { message: `Tool "${toolName}" not found` } });
        return;
      }
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
    // Measure the wire size as UTF-8 bytes, not JS code units, so a 16 KB
    // cap lines up with what the executor / upstream actually receive.
    if (textEncoder.encode(argString).byteLength > MAX_ARG_BYTES) {
      res.status(413).json({ error: { message: "Arguments too large" } });
      return;
    }

    // Build a per-request override config so the in-process tool branch
    // can find a customTools entry that matches the draft (which may
    // differ from the saved one). The executor itself is shared.
    const overrideConfig: typeof config = {
      ...config,
      tools: {
        ...config.tools,
        customTools: [
          ...config.tools.customTools.filter((t) => t.name !== tool!.name),
          tool,
        ],
      },
    };

    const result = await toolExecutor.execute(
      { id: `test-${Date.now()}`, function: { name: tool.name, arguments: argString } },
      overrideConfig,
    );

    // Truncate the wire response by UTF-8 bytes (not String.length) so
    // the 10 KB cap survives multibyte payloads without splitting a
    // Unicode character.
    const resultBytes = textEncoder.encode(result.result).byteLength;
    const truncated = resultBytes > MAX_RESULT_BYTES;
    const wireResult = truncated ? truncateUtf8(result.result, MAX_RESULT_BYTES) : result.result;
    res.json({
      ok: result.ok,
      name: result.name,
      result: wireResult,
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
