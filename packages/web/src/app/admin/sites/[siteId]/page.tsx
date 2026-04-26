"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSite, updateSite, deleteSite } from "@/lib/api";

interface FormData {
  siteId: string;
  allowedOrigins: string;
  enabled: boolean;
  branding: {
    name: string;
    tagline: string;
    position: "bottom-right" | "bottom-left";
    welcomeMessage: string;
    inputPlaceholder: string;
    colors: {
      primary: string;
      primaryForeground: string;
      background: string;
      foreground: string;
      bubbleBackground: string;
      userBubbleBackground: string;
      userBubbleForeground: string;
    };
  };
  ai: {
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  guardrails: {
    allowedTopics: string;
    topicDescription: string;
    refusalMessage: string;
  };
  rateLimit: {
    messagesPerMinute: number;
    messagesPerHour: number;
    messagesPerDay: number;
  };
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-semibold">{title}</span>
        <span className="text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-border px-5 py-5 space-y-4">{children}</div>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

const labelClass = "mb-1 block text-sm font-medium text-foreground";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function siteToForm(site: any): FormData {
  return {
    siteId: site.siteId,
    allowedOrigins: (site.allowedOrigins || []).join(", "),
    enabled: site.enabled ?? true,
    branding: {
      name: site.branding?.name || "Assistant",
      tagline: site.branding?.tagline || "",
      position: site.branding?.position || "bottom-right",
      welcomeMessage: site.branding?.welcomeMessage || "Hi! How can I help you today?",
      inputPlaceholder: site.branding?.inputPlaceholder || "Type your message...",
      colors: {
        primary: site.branding?.colors?.primary || "#6366f1",
        primaryForeground: site.branding?.colors?.primaryForeground || "#ffffff",
        background: site.branding?.colors?.background || "#ffffff",
        foreground: site.branding?.colors?.foreground || "#1f2937",
        bubbleBackground: site.branding?.colors?.bubbleBackground || "#f3f4f6",
        userBubbleBackground: site.branding?.colors?.userBubbleBackground || "#6366f1",
        userBubbleForeground: site.branding?.colors?.userBubbleForeground || "#ffffff",
      },
    },
    ai: {
      baseUrl: site.ai?.baseUrl || "",
      apiKey: site.ai?.apiKey || "ollama",
      model: site.ai?.model || "",
      temperature: site.ai?.temperature ?? 0.7,
      maxTokens: site.ai?.maxTokens ?? 1024,
    },
    guardrails: {
      allowedTopics: (site.guardrails?.allowedTopics || []).join(", "),
      topicDescription: site.guardrails?.topicDescription || "",
      refusalMessage:
        site.guardrails?.refusalMessage ||
        "I can only help with topics related to this website. Is there something else I can assist you with?",
    },
    rateLimit: {
      messagesPerMinute: site.rateLimit?.messagesPerMinute ?? 10,
      messagesPerHour: site.rateLimit?.messagesPerHour ?? 100,
      messagesPerDay: site.rateLimit?.messagesPerDay ?? 1000,
    },
  };
}

export default function EditSitePage() {
  const params = useParams<{ siteId: string }>();
  const router = useRouter();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.siteId) return;
    fetchSite(params.siteId)
      .then((data) => {
        if (!data) {
          setNotFound(true);
        } else {
          setForm(siteToForm(data));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.siteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Loading site configuration...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-lg font-medium">Site not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No site with ID &quot;{params.siteId}&quot; exists.
        </p>
        <button
          type="button"
          onClick={() => router.push("/admin/sites")}
          className="mt-6 rounded-lg border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back to Sites
        </button>
      </div>
    );
  }

  if (!form) return null;

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateBranding<K extends keyof FormData["branding"]>(
    key: K,
    value: FormData["branding"][K],
  ) {
    setForm((prev) => (prev ? { ...prev, branding: { ...prev.branding, [key]: value } } : prev));
  }

  function updateColor(key: keyof FormData["branding"]["colors"], value: string) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            branding: {
              ...prev.branding,
              colors: { ...prev.branding.colors, [key]: value },
            },
          }
        : prev,
    );
  }

  function updateAi<K extends keyof FormData["ai"]>(key: K, value: FormData["ai"][K]) {
    setForm((prev) => (prev ? { ...prev, ai: { ...prev.ai, [key]: value } } : prev));
  }

  function updateGuardrails<K extends keyof FormData["guardrails"]>(
    key: K,
    value: FormData["guardrails"][K],
  ) {
    setForm((prev) =>
      prev ? { ...prev, guardrails: { ...prev.guardrails, [key]: value } } : prev,
    );
  }

  function updateRateLimit<K extends keyof FormData["rateLimit"]>(
    key: K,
    value: FormData["rateLimit"][K],
  ) {
    setForm((prev) => (prev ? { ...prev, rateLimit: { ...prev.rateLimit, [key]: value } } : prev));
  }

  function validate(): string | null {
    if (!form) return "No form data.";
    const origins = form.allowedOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (origins.length === 0) return "At least one allowed origin is required.";
    if (!form.ai.baseUrl.trim()) return "AI base URL is required.";
    if (!form.ai.model.trim()) return "AI model is required.";
    const topics = form.guardrails.allowedTopics
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (topics.length === 0) return "At least one allowed topic is required.";
    if (!form.guardrails.topicDescription.trim()) return "Topic description is required.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        siteId: form.siteId,
        allowedOrigins: form.allowedOrigins
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        enabled: form.enabled,
        branding: {
          name: form.branding.name,
          tagline: form.branding.tagline || undefined,
          colors: form.branding.colors,
          position: form.branding.position,
          welcomeMessage: form.branding.welcomeMessage,
          inputPlaceholder: form.branding.inputPlaceholder,
        },
        ai: {
          baseUrl: form.ai.baseUrl.trim(),
          apiKey: form.ai.apiKey,
          model: form.ai.model.trim(),
          temperature: form.ai.temperature,
          maxTokens: form.ai.maxTokens,
        },
        guardrails: {
          allowedTopics: form.guardrails.allowedTopics
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          topicDescription: form.guardrails.topicDescription,
          refusalMessage: form.guardrails.refusalMessage,
        },
        rateLimit: form.rateLimit,
      };

      await updateSite(form.siteId, payload);
      router.push("/admin/sites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update site");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form) return;
    if (!window.confirm(`Delete site "${form.siteId}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteSite(form.siteId);
      router.push("/admin/sites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete site");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Edit Site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Editing configuration for <span className="font-mono text-foreground">{form.siteId}</span>
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic */}
        <Section title="Basic" defaultOpen>
          <div>
            <label htmlFor="siteId" className={labelClass}>
              Site ID
            </label>
            <input
              id="siteId"
              type="text"
              value={form.siteId}
              disabled
              className={`${inputClass} cursor-not-allowed opacity-60`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Site ID cannot be changed after creation
            </p>
          </div>
          <div>
            <label htmlFor="allowedOrigins" className={labelClass}>
              Allowed Origins
            </label>
            <input
              id="allowedOrigins"
              type="text"
              required
              value={form.allowedOrigins}
              onChange={(e) => updateField("allowedOrigins", e.target.value)}
              placeholder="https://example.com, https://www.example.com"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma-separated URLs that can embed the widget
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="enabled"
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => updateField("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
            />
            <label htmlFor="enabled" className="text-sm font-medium">
              Enabled
            </label>
          </div>
        </Section>

        {/* Branding */}
        <Section title="Branding">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="brandingName" className={labelClass}>
                Name
              </label>
              <input
                id="brandingName"
                type="text"
                value={form.branding.name}
                onChange={(e) => updateBranding("name", e.target.value)}
                placeholder="Assistant"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="brandingTagline" className={labelClass}>
                Tagline
              </label>
              <input
                id="brandingTagline"
                type="text"
                value={form.branding.tagline}
                onChange={(e) => updateBranding("tagline", e.target.value)}
                placeholder="How can we help?"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="brandingPosition" className={labelClass}>
              Position
            </label>
            <select
              id="brandingPosition"
              value={form.branding.position}
              onChange={(e) =>
                updateBranding("position", e.target.value as "bottom-right" | "bottom-left")
              }
              className={inputClass}
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>
          <div>
            <label htmlFor="welcomeMessage" className={labelClass}>
              Welcome Message
            </label>
            <textarea
              id="welcomeMessage"
              rows={2}
              value={form.branding.welcomeMessage}
              onChange={(e) => updateBranding("welcomeMessage", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="inputPlaceholder" className={labelClass}>
              Input Placeholder
            </label>
            <input
              id="inputPlaceholder"
              type="text"
              value={form.branding.inputPlaceholder}
              onChange={(e) => updateBranding("inputPlaceholder", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <p className={labelClass}>Colors</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                Object.entries(form.branding.colors) as [
                  keyof FormData["branding"]["colors"],
                  string,
                ][]
              ).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border"
                  />
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateColor(key, e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* AI Provider */}
        <Section title="AI Provider">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="aiBaseUrl" className={labelClass}>
                Base URL
              </label>
              <input
                id="aiBaseUrl"
                type="url"
                required
                value={form.ai.baseUrl}
                onChange={(e) => updateAi("baseUrl", e.target.value)}
                placeholder="http://localhost:11434/v1"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="aiApiKey" className={labelClass}>
                API Key
              </label>
              <input
                id="aiApiKey"
                type="password"
                value={form.ai.apiKey}
                onChange={(e) => updateAi("apiKey", e.target.value)}
                placeholder="ollama"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="aiModel" className={labelClass}>
                Model
              </label>
              <input
                id="aiModel"
                type="text"
                required
                value={form.ai.model}
                onChange={(e) => updateAi("model", e.target.value)}
                placeholder="llama3"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="aiTemperature" className={labelClass}>
                Temperature: {form.ai.temperature}
              </label>
              <input
                id="aiTemperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={form.ai.temperature}
                onChange={(e) => updateAi("temperature", parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>2</span>
              </div>
            </div>
            <div>
              <label htmlFor="aiMaxTokens" className={labelClass}>
                Max Tokens
              </label>
              <input
                id="aiMaxTokens"
                type="number"
                min={1}
                max={32768}
                value={form.ai.maxTokens}
                onChange={(e) => updateAi("maxTokens", parseInt(e.target.value, 10) || 1024)}
                className={inputClass}
              />
            </div>
          </div>
        </Section>

        {/* Guardrails */}
        <Section title="Guardrails">
          <div>
            <label htmlFor="allowedTopics" className={labelClass}>
              Allowed Topics
            </label>
            <input
              id="allowedTopics"
              type="text"
              required
              value={form.guardrails.allowedTopics}
              onChange={(e) => updateGuardrails("allowedTopics", e.target.value)}
              placeholder="product support, pricing, onboarding"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma-separated list of topics the assistant can discuss
            </p>
          </div>
          <div>
            <label htmlFor="topicDescription" className={labelClass}>
              Topic Description
            </label>
            <textarea
              id="topicDescription"
              rows={3}
              required
              value={form.guardrails.topicDescription}
              onChange={(e) => updateGuardrails("topicDescription", e.target.value)}
              placeholder="This assistant helps users with product support questions, pricing inquiries, and onboarding."
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="refusalMessage" className={labelClass}>
              Refusal Message
            </label>
            <textarea
              id="refusalMessage"
              rows={2}
              value={form.guardrails.refusalMessage}
              onChange={(e) => updateGuardrails("refusalMessage", e.target.value)}
              className={inputClass}
            />
          </div>
        </Section>

        {/* Rate Limits */}
        <Section title="Rate Limits">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="ratePerMinute" className={labelClass}>
                Per Minute
              </label>
              <input
                id="ratePerMinute"
                type="number"
                min={1}
                max={120}
                value={form.rateLimit.messagesPerMinute}
                onChange={(e) =>
                  updateRateLimit("messagesPerMinute", parseInt(e.target.value, 10) || 10)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ratePerHour" className={labelClass}>
                Per Hour
              </label>
              <input
                id="ratePerHour"
                type="number"
                min={1}
                max={1000}
                value={form.rateLimit.messagesPerHour}
                onChange={(e) =>
                  updateRateLimit("messagesPerHour", parseInt(e.target.value, 10) || 100)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ratePerDay" className={labelClass}>
                Per Day
              </label>
              <input
                id="ratePerDay"
                type="number"
                min={1}
                max={10000}
                value={form.rateLimit.messagesPerDay}
                onChange={(e) =>
                  updateRateLimit("messagesPerDay", parseInt(e.target.value, 10) || 1000)
                }
                className={inputClass}
              />
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/sites")}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:border-red-800 dark:text-red-400"
          >
            Delete Site
          </button>
        </div>
      </form>
    </div>
  );
}
