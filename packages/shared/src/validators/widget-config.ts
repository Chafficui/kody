import { z } from "zod";

/**
 * Embed-time configuration accepted via `window.KodyConfig`, the
 * `data-*` attribute set on the <script> tag, or the ESM `mount()`
 * function. Validation is strict on shape but loose on unknown keys so
 * hosts can add custom fields without breaking.
 */

const jsonObject = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional();

export const widgetBrandingSchema = z
  .object({
    name: z.string().optional(),
    primaryColor: z.string().optional(),
    position: z.enum(["bottom-right", "bottom-left"]).optional(),
  })
  .optional();

export const widgetMountConfigSchema = z.object({
  siteId: z.string().min(1, "siteId is required"),
  serverUrl: z.string().url().optional(),
  branding: widgetBrandingSchema,

  // New embed-time fields (Stream B)
  locale: z.string().min(2).max(10).optional(),
  openOnLoad: z.boolean().optional(),
  prefillMessage: z.string().optional(),
  userId: z.string().optional(),
  userTraits: jsonObject,
  theme: z.enum(["light", "dark", "auto"]).optional(),
  userContext: jsonObject,
  keyboardShortcut: z.union([z.string(), z.boolean()]).optional(),
});

export type WidgetMountConfig = z.infer<typeof widgetMountConfigSchema>;
export type WidgetBranding = z.infer<typeof widgetBrandingSchema>;

/**
 * A structural type compatible with `HTMLScriptElement.dataset`. The
 * shared package keeps it DOM-agnostic so it can be compiled under
 * both browser and Node consumers.
 */
export interface DataAttributeMap {
  [key: string]: string | undefined;
  siteId?: string;
  serverUrl?: string;
  locale?: string;
  openOnLoad?: string;
  prefillMessage?: string;
  userId?: string;
  userTraits?: string;
  theme?: string;
  userContext?: string;
  keyboardShortcut?: string;
}

/**
 * Parse a `data-*` attribute set + window config into a typed
 * WidgetMountConfig. Throws on missing siteId; logs a warning and
 * ignores invalid optional fields rather than throwing.
 */
export function parseDataAttributes(
  dataset: DataAttributeMap,
  windowConfig: Record<string, unknown> | null | undefined,
): WidgetMountConfig {
  const fromWindow: Record<string, unknown> = { ...(windowConfig ?? {}) };
  const fromData: Record<string, unknown> = {};

  if (dataset.siteId) fromData.siteId = dataset.siteId;
  if (dataset.serverUrl) fromData.serverUrl = dataset.serverUrl;
  if (dataset.locale) fromData.locale = dataset.locale;
  if (dataset.openOnLoad === "true") fromData.openOnLoad = true;
  if (dataset.openOnLoad === "false") fromData.openOnLoad = false;
  if (dataset.prefillMessage) fromData.prefillMessage = dataset.prefillMessage;
  if (dataset.userId) fromData.userId = dataset.userId;
  if (dataset.userTraits) {
    try {
      fromData.userTraits = JSON.parse(dataset.userTraits);
    } catch {
      console.warn("[Kody] data-user-traits is not valid JSON, ignoring");
    }
  }
  if (dataset.theme) fromData.theme = dataset.theme;
  if (dataset.userContext) {
    try {
      fromData.userContext = JSON.parse(dataset.userContext);
    } catch {
      console.warn("[Kody] data-user-context is not valid JSON, ignoring");
    }
  }
  if (dataset.keyboardShortcut) fromData.keyboardShortcut = dataset.keyboardShortcut;

  // Window config wins on conflict; data-* is the fallback.
  const merged = { ...fromData, ...fromWindow };

  const result = widgetMountConfigSchema.safeParse(merged);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`[Kody] Invalid widget configuration: ${first?.message ?? "unknown"}`);
  }
  return result.data;
}
