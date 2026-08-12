/**
 * Tiny embed-config validator for the widget. Lives inside the widget
 * bundle to avoid pulling zod (~14KB gzipped) into the IIFE. The same
 * shape is mirrored in `@kody/shared/validators/widget-config` for
 * server-side use; keep them in sync.
 *
 * The full Zod schema in the shared package is the source of truth
 * for the canonical type — this file is an optimisation for bundle
 * size only.
 */

import type { WidgetMountConfig } from "@kody/shared";

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

const VALID_THEMES = new Set(["light", "dark", "auto"]);
const VALID_POSITIONS = new Set(["bottom-right", "bottom-left"]);

function tryParseJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Merge a `data-*` attribute map and a window config into a
 * WidgetMountConfig. Window config wins on conflict. Throws when
 * siteId is missing.
 */
export function parseEmbedConfig(
  dataset: DataAttributeMap,
  windowConfig: Record<string, unknown> | null | undefined,
): WidgetMountConfig {
  const fromData: Record<string, unknown> = {};
  const fromWindow: Record<string, unknown> = { ...(windowConfig ?? {}) };

  if (dataset.siteId) fromData.siteId = dataset.siteId;
  if (dataset.serverUrl) fromData.serverUrl = dataset.serverUrl;
  if (dataset.locale) fromData.locale = dataset.locale;
  if (dataset.openOnLoad === "true") fromData.openOnLoad = true;
  if (dataset.openOnLoad === "false") fromData.openOnLoad = false;
  if (dataset.prefillMessage) fromData.prefillMessage = dataset.prefillMessage;
  if (dataset.userId) fromData.userId = dataset.userId;
  if (dataset.userTraits) {
    const parsed = tryParseJson(dataset.userTraits);
    if (parsed && typeof parsed === "object") fromData.userTraits = parsed as Record<string, unknown>;
  }
  if (dataset.theme && VALID_THEMES.has(dataset.theme)) fromData.theme = dataset.theme;
  if (dataset.userContext) {
    const parsed = tryParseJson(dataset.userContext);
    if (parsed && typeof parsed === "object") fromData.userContext = parsed as Record<string, unknown>;
  }
  if (dataset.keyboardShortcut) fromData.keyboardShortcut = dataset.keyboardShortcut;

  // Window config wins on conflict.
  const merged: Record<string, unknown> = { ...fromData, ...fromWindow };

  if (typeof merged.siteId !== "string" || merged.siteId.length === 0) {
    throw new Error("[Kody] siteId is required");
  }

  // Normalize optional fields.
  const out: WidgetMountConfig = {
    siteId: merged.siteId,
    serverUrl: typeof merged.serverUrl === "string" ? merged.serverUrl : undefined,
    branding: undefined,
    locale: typeof merged.locale === "string" ? merged.locale : undefined,
    openOnLoad: typeof merged.openOnLoad === "boolean" ? merged.openOnLoad : undefined,
    prefillMessage: typeof merged.prefillMessage === "string" ? merged.prefillMessage : undefined,
    userId: typeof merged.userId === "string" ? merged.userId : undefined,
    userTraits: isRecord(merged.userTraits) ? merged.userTraits : undefined,
    theme: isStringIn(merged.theme, VALID_THEMES) ? (merged.theme as "light" | "dark" | "auto") : undefined,
    userContext: isRecord(merged.userContext) ? merged.userContext : undefined,
    keyboardShortcut: typeof merged.keyboardShortcut === "string" || typeof merged.keyboardShortcut === "boolean"
      ? merged.keyboardShortcut
      : undefined,
  };

  // Build the nested branding object if any of its fields are present.
  const brandingInput = isRecord(merged.branding) ? merged.branding : {};
  const fromDataBranding = isRecord(fromData.branding) ? fromData.branding : {};
  const branding = {
    name: pickString(brandingInput.name) ?? pickString(fromDataBranding.name) ?? pickString(dataset.name),
    primaryColor: pickString(brandingInput.primaryColor) ?? pickString(fromDataBranding.primaryColor) ?? pickString(dataset.primaryColor),
    position: pickStringIn(
      brandingInput.position ?? fromDataBranding.position ?? dataset.position,
      VALID_POSITIONS,
    ) as "bottom-right" | "bottom-left" | undefined,
  };
  if (branding.name || branding.primaryColor || branding.position) {
    out.branding = branding;
  }

  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function pickStringIn(v: unknown, valid: Set<string>): string | undefined {
  return typeof v === "string" && valid.has(v) ? v : undefined;
}

function isStringIn(v: unknown, valid: Set<string>): boolean {
  return typeof v === "string" && valid.has(v);
}
