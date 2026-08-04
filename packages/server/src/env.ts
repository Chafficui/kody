import { z } from "zod";

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
   * Public origin where this server is reachable, e.g.
   * `https://kody.example.com`. Used by the demo seed to add a
   * matching `allowedOrigin` for the demo site, and by any future
   * caller-facing code that needs to know the public URL.
   * Comma-separated for multiple origins.
   */
  PUBLIC_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
