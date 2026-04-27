import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { createSite } from "@/lib/api";

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

const DEFAULT_FORM: FormData = {
  siteId: "",
  allowedOrigins: "",
  enabled: true,
  branding: {
    name: "Assistant",
    tagline: "",
    position: "bottom-right",
    welcomeMessage: "Hi! How can I help you today?",
    inputPlaceholder: "Type your message...",
    colors: {
      primary: "#6366f1",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#1f2937",
      bubbleBackground: "#f3f4f6",
      userBubbleBackground: "#6366f1",
      userBubbleForeground: "#ffffff",
    },
  },
  ai: {
    baseUrl: "",
    apiKey: "ollama",
    model: "",
    temperature: 0.7,
    maxTokens: 1024,
  },
  guardrails: {
    allowedTopics: "",
    topicDescription: "",
    refusalMessage:
      "I can only help with topics related to this website. Is there something else I can assist you with?",
  },
  rateLimit: {
    messagesPerMinute: 10,
    messagesPerHour: 100,
    messagesPerDay: 1000,
  },
};

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

export default function SiteCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateBranding<K extends keyof FormData["branding"]>(
    key: K,
    value: FormData["branding"][K],
  ) {
    setForm((prev) => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  }

  function updateColor(key: keyof FormData["branding"]["colors"], value: string) {
    setForm((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        colors: { ...prev.branding.colors, [key]: value },
      },
    }));
  }

  function updateAi<K extends keyof FormData["ai"]>(key: K, value: FormData["ai"][K]) {
    setForm((prev) => ({
      ...prev,
      ai: { ...prev.ai, [key]: value },
    }));
  }

  function updateGuardrails<K extends keyof FormData["guardrails"]>(
    key: K,
    value: FormData["guardrails"][K],
  ) {
    setForm((prev) => ({
      ...prev,
      guardrails: { ...prev.guardrails, [key]: value },
    }));
  }

  function updateRateLimit<K extends keyof FormData["rateLimit"]>(
    key: K,
    value: FormData["rateLimit"][K],
  ) {
    setForm((prev) => ({
      ...prev,
      rateLimit: { ...prev.rateLimit, [key]: value },
    }));
  }

  function validate(): string | null {
    if (!form.siteId.trim()) return "Site ID is required.";
    if (!/^[a-z0-9-]+$/.test(form.siteId))
      return "Site ID must be lowercase alphanumeric with hyphens.";
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
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        siteId: form.siteId.trim(),
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

      await createSite(payload);
      navigate("/sites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Create New Site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a new site for the Kody widget.
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
              required
              value={form.siteId}
              onChange={(e) => updateField("siteId", e.target.value)}
              placeholder="my-site"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase alphanumeric with hyphens (e.g. my-site)
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

        {/* Submit */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Site"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/sites")}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
