import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { createSite } from "@/lib/api";

interface KnowledgeSourceForm {
  type: "text" | "faq" | "url";
  title: string;
  content: string;
  url: string;
  entries: { question: string; answer: string }[];
}

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
  knowledge: {
    sources: KnowledgeSourceForm[];
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
  knowledge: {
    sources: [],
  },
  rateLimit: {
    messagesPerMinute: 10,
    messagesPerHour: 100,
    messagesPerDay: 1000,
  },
};

const STEP_LABELS = [
  "Basic Info",
  "AI Provider",
  "Branding",
  "Guardrails",
  "Knowledge Sources",
  "Review",
];

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

const labelClass = "mb-1 block text-sm font-medium text-foreground";

function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <div className="flex items-center justify-between">
      {STEP_LABELS.map((label, idx) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                idx === currentStep
                  ? "bg-primary text-primary-foreground"
                  : completedSteps.has(idx)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {completedSteps.has(idx) && idx !== currentStep ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <span
              className={`mt-1 text-[10px] font-medium whitespace-nowrap ${
                idx === currentStep ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
          {idx < STEP_LABELS.length - 1 && (
            <div
              className={`mx-1 h-0.5 flex-1 rounded transition-colors ${
                completedSteps.has(idx) ? "bg-primary/40" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function SiteCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

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

  function updateKnowledgeSources(sources: KnowledgeSourceForm[]) {
    setForm((prev) => ({ ...prev, knowledge: { sources } }));
  }

  function validateStep(s: number): string | null {
    switch (s) {
      case 0: {
        if (!form.siteId.trim()) return "Site ID is required.";
        if (!/^[a-z0-9-]+$/.test(form.siteId))
          return "Site ID must be lowercase alphanumeric with hyphens.";
        const origins = form.allowedOrigins
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
        if (origins.length === 0) return "At least one allowed origin is required.";
        return null;
      }
      case 1: {
        if (!form.ai.baseUrl.trim()) return "AI base URL is required.";
        if (!form.ai.model.trim()) return "AI model is required.";
        return null;
      }
      case 2:
        return null;
      case 3: {
        const topics = form.guardrails.allowedTopics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (topics.length === 0) return "At least one allowed topic is required.";
        if (!form.guardrails.topicDescription.trim()) return "Topic description is required.";
        return null;
      }
      case 4:
        return null;
      case 5:
        return null;
      default:
        return null;
    }
  }

  function validate(): string | null {
    for (let i = 0; i < STEP_LABELS.length; i++) {
      const err = validateStep(i);
      if (err) return err;
    }
    return null;
  }

  function handleNext() {
    setError(null);
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setCompletedSteps((prev) => new Set([...prev, step]));
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
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
        knowledge: {
          sources: form.knowledge.sources
            .filter((s) => {
              if (s.type === "text") return s.title.trim() && s.content.trim();
              if (s.type === "url") return s.url.trim();
              if (s.type === "faq") return s.entries.length > 0;
              return false;
            })
            .map((s) => {
              if (s.type === "text") {
                return {
                  type: "text" as const,
                  title: s.title,
                  content: s.content,
                  ...(s.url.trim() ? { url: s.url.trim() } : {}),
                };
              }
              if (s.type === "url") {
                return {
                  type: "url" as const,
                  url: s.url,
                  ...(s.title.trim() ? { title: s.title } : {}),
                };
              }
              return {
                type: "faq" as const,
                entries: s.entries.filter((e) => e.question.trim() && e.answer.trim()),
                ...(s.url.trim() ? { url: s.url.trim() } : {}),
              };
            }),
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

  function renderStepBasicInfo() {
    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="siteId" className={labelClass}>
            Site ID
          </label>
          <input
            id="siteId"
            type="text"
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
      </div>
    );
  }

  function renderStepAiProvider() {
    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="aiBaseUrl" className={labelClass}>
            Base URL
          </label>
          <input
            id="aiBaseUrl"
            type="url"
            value={form.ai.baseUrl}
            onChange={(e) => updateAi("baseUrl", e.target.value)}
            placeholder="http://localhost:11434/v1"
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    );
  }

  function renderStepBranding() {
    return (
      <div className="space-y-4">
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
      </div>
    );
  }

  function renderStepGuardrails() {
    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="allowedTopics" className={labelClass}>
            Allowed Topics
          </label>
          <input
            id="allowedTopics"
            type="text"
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
      </div>
    );
  }

  function renderStepKnowledge() {
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Add content the assistant can reference when answering questions. Each source gets a
          citation number that users can click.
        </p>
        {form.knowledge.sources.map((source, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Source #{idx + 1}</span>
              <button
                type="button"
                onClick={() => {
                  const sources = [...form.knowledge.sources];
                  sources.splice(idx, 1);
                  updateKnowledgeSources(sources);
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Type</label>
                <select
                  value={source.type}
                  onChange={(e) => {
                    const sources = [...form.knowledge.sources];
                    sources[idx] = {
                      ...sources[idx],
                      type: e.target.value as "text" | "faq" | "url",
                    };
                    updateKnowledgeSources(sources);
                  }}
                  className={inputClass}
                >
                  <option value="text">Text</option>
                  <option value="faq">FAQ</option>
                  <option value="url">URL (auto-fetch)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Title</label>
                <input
                  type="text"
                  value={source.title}
                  onChange={(e) => {
                    const sources = [...form.knowledge.sources];
                    sources[idx] = { ...sources[idx], title: e.target.value };
                    updateKnowledgeSources(sources);
                  }}
                  placeholder="e.g. About Us"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Source URL (for citations)</label>
              <input
                type="text"
                value={source.url}
                onChange={(e) => {
                  const sources = [...form.knowledge.sources];
                  sources[idx] = { ...sources[idx], url: e.target.value };
                  updateKnowledgeSources(sources);
                }}
                placeholder="https://example.com/about"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Citation links point here when the AI references this source
              </p>
            </div>
            {source.type === "text" && (
              <div>
                <label className={labelClass}>Content</label>
                <textarea
                  rows={4}
                  value={source.content}
                  onChange={(e) => {
                    const sources = [...form.knowledge.sources];
                    sources[idx] = { ...sources[idx], content: e.target.value };
                    updateKnowledgeSources(sources);
                  }}
                  placeholder="Paste the knowledge text here..."
                  className={inputClass}
                />
              </div>
            )}
            {source.type === "faq" && (
              <div className="space-y-2">
                <label className={labelClass}>FAQ Entries</label>
                {source.entries.map((entry, eIdx) => (
                  <div key={eIdx} className="flex gap-2">
                    <input
                      type="text"
                      value={entry.question}
                      onChange={(e) => {
                        const sources = [...form.knowledge.sources];
                        const entries = [...sources[idx].entries];
                        entries[eIdx] = { ...entries[eIdx], question: e.target.value };
                        sources[idx] = { ...sources[idx], entries };
                        updateKnowledgeSources(sources);
                      }}
                      placeholder="Question"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="text"
                      value={entry.answer}
                      onChange={(e) => {
                        const sources = [...form.knowledge.sources];
                        const entries = [...sources[idx].entries];
                        entries[eIdx] = { ...entries[eIdx], answer: e.target.value };
                        sources[idx] = { ...sources[idx], entries };
                        updateKnowledgeSources(sources);
                      }}
                      placeholder="Answer"
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const sources = [...form.knowledge.sources];
                        const entries = [...sources[idx].entries];
                        entries.splice(eIdx, 1);
                        sources[idx] = { ...sources[idx], entries };
                        updateKnowledgeSources(sources);
                      }}
                      className="text-xs text-red-500 hover:text-red-700 px-2"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const sources = [...form.knowledge.sources];
                    sources[idx] = {
                      ...sources[idx],
                      entries: [...sources[idx].entries, { question: "", answer: "" }],
                    };
                    updateKnowledgeSources(sources);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  + Add FAQ entry
                </button>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            updateKnowledgeSources([
              ...form.knowledge.sources,
              { type: "text", title: "", content: "", url: "", entries: [] },
            ]);
          }}
          className="rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary w-full"
        >
          + Add Knowledge Source
        </button>
      </div>
    );
  }

  function renderReviewCard(
    title: string,
    stepIndex: number,
    items: { label: string; value: string }[],
  ) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">{title}</span>
          <button
            type="button"
            onClick={() => setStep(stepIndex)}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="grid gap-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex text-sm">
              <span className="w-40 shrink-0 text-muted-foreground">{item.label}</span>
              <span className="text-foreground truncate">{item.value || "-"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderStepReview() {
    return (
      <div className="space-y-4">
        {renderReviewCard("Basic Info", 0, [
          { label: "Site ID", value: form.siteId },
          { label: "Allowed Origins", value: form.allowedOrigins },
          { label: "Enabled", value: form.enabled ? "Yes" : "No" },
        ])}
        {renderReviewCard("AI Provider", 1, [
          { label: "Base URL", value: form.ai.baseUrl },
          { label: "API Key", value: form.ai.apiKey ? "***" : "-" },
          { label: "Model", value: form.ai.model },
          { label: "Temperature", value: String(form.ai.temperature) },
          { label: "Max Tokens", value: String(form.ai.maxTokens) },
        ])}
        {renderReviewCard("Branding", 2, [
          { label: "Name", value: form.branding.name },
          { label: "Tagline", value: form.branding.tagline },
          { label: "Position", value: form.branding.position },
          { label: "Welcome Message", value: form.branding.welcomeMessage },
          { label: "Input Placeholder", value: form.branding.inputPlaceholder },
        ])}
        {renderReviewCard("Guardrails", 3, [
          { label: "Allowed Topics", value: form.guardrails.allowedTopics },
          { label: "Topic Description", value: form.guardrails.topicDescription },
          { label: "Refusal Message", value: form.guardrails.refusalMessage },
        ])}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Knowledge Sources</span>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="text-xs text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          {form.knowledge.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No knowledge sources added.</p>
          ) : (
            <div className="space-y-2">
              {form.knowledge.sources.map((source, idx) => (
                <div key={idx} className="text-sm flex gap-2">
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground uppercase">
                    {source.type}
                  </span>
                  <span className="text-foreground truncate">
                    {source.type === "faq"
                      ? `${source.entries.length} entries${source.url ? ` - ${source.url}` : ""}`
                      : source.title || source.url || "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderCurrentStep() {
    switch (step) {
      case 0:
        return renderStepBasicInfo();
      case 1:
        return renderStepAiProvider();
      case 2:
        return renderStepBranding();
      case 3:
        return renderStepGuardrails();
      case 4:
        return renderStepKnowledge();
      case 5:
        return renderStepReview();
      default:
        return null;
    }
  }

  const isLastStep = step === STEP_LABELS.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Create New Site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a new site for the Kody widget.
        </p>
      </div>

      <StepIndicator currentStep={step} completedSteps={completedSteps} />

      {error && (
        <p className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-border bg-background px-5 py-5">
        <h3 className="mb-4 text-base font-semibold">{STEP_LABELS[step]}</h3>
        {renderCurrentStep()}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/sites")}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          {isLastStep ? (
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Site"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
