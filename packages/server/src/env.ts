import { z } from "zod";

/**
 * Parse the comma-separated `PUBLIC_ORIGIN` env value into a
 * deduped list of valid origin URLs. Each entry is validated
 * with `new URL()` so a typo like `https:/example.com` or a
 * scheme-less value like `example.com` is rejected at env
 * load time. Empty entries (e.g. from a trailing comma or
 * `,,`) are dropped. The field stays optional: an unset
 * `PUBLIC_ORIGIN` means the operator does not want any
 * extra origins added to the demo site's allow-list, which
 * the demo-seed code already handles.
 */
const publicOriginSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === "") return undefined;
    const parts = value
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) return undefined;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of parts) {
      try {
        const url = new URL(part);
        // Accept http(s) origins only. Anything else (file:,
        // data:, javascript:, etc.) is a misconfiguration.
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `PUBLIC_ORIGIN entry "${part}" must be an http(s) URL`,
          });
          return z.NEVER;
        }
        const origin = url.origin;
        if (!seen.has(origin)) {
          seen.add(origin);
          out.push(origin);
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `PUBLIC_ORIGIN entry "${part}" is not a valid URL`,
        });
        return z.NEVER;
      }
    }
    return out;
  });

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3456),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_PATH: z.string().default("./kody.db"),
  CORS_ALLOW_ALL_DEV: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  /**
   * Public origin(s) where this server is reachable, e.g.
   * `https://kody.example.com`. Used by the demo seed to add
   * a matching `allowedOrigin` for the demo site, and by any
   * future caller-facing code that needs to know the public
   * URL(s). Comma-separated for multiple origins. Each entry
   * is validated as a valid http(s) origin at load time;
   * invalid values cause schema parsing to fail before any
   * downstream demo-seed handling runs.
   */
  PUBLIC_ORIGIN: publicOriginSchema,
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
