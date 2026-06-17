import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchSite, updateSite, deleteSite } from "@/lib/api";

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
    bubbleIcon: "chat" | "headset" | "robot" | "custom";
    bubbleIconUrl: string;
    bubbleSize: "sm" | "md" | "lg";
    theme: "light" | "dark" | "auto";
    borderRadius: number;
    fontFamily: string;
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
  personality: {
    tone: "friendly" | "professional" | "casual";
    formality: "formal" | "informal" | "balanced";
    responseLength: "concise" | "balanced" | "detailed";
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
  tools: {
    enabled: boolean;
    maxToolCalls: number;
    builtinTools: { knowledgeSearch: boolean };
    customTools: Array<{
      name: string;
      description: string;
      parameters: {
        type: "object";
        properties: Record<string, { type: string; description: string; enum?: string[] }>;
        required: string[];
      };
      endpoint: {
        url: string;
        method: "GET" | "POST" | "PUT" | "PATCH";
        headers: Record<string, string>;
        timeoutMs: number;
      };
    }>;
  };
  rag: {
    enabled: boolean;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    similarityThreshold: number;
  };
  rateLimit: {
    messagesPerMinute: number;
    messagesPerHour: number;
    messagesPerDay: number;
  };
  compliance: {
    aiDisclosureEnabled: boolean;
    aiDisclosureMessage: string;
    conversationDeletionEnabled: boolean;
  };
  conversationStarters: string[];
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
      bubbleIcon: site.branding?.bubbleIcon || "chat",
      bubbleIconUrl: site.branding?.bubbleIconUrl || "",
      bubbleSize: site.branding?.bubbleSize || "md",
      theme: site.branding?.theme || "light",
      borderRadius: site.branding?.borderRadius ?? 12,
      fontFamily: site.branding?.fontFamily || "",
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
    personality: {
      tone: site.personality?.tone || "friendly",
      formality: site.personality?.formality || "balanced",
      responseLength: site.personality?.responseLength || "balanced",
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
    knowledge: {
      sources: (site.knowledge?.sources || []).map((s: Record<string, unknown>) => ({
        type: s.type || "text",
        title: s.title || "",
        content: s.content || "",
        url: s.url || "",
        entries: s.entries || [],
      })),
    },
    tools: {
      enabled: site.tools?.enabled ?? false,
      maxToolCalls: site.tools?.maxToolCalls ?? 5,
      builtinTools: { knowledgeSearch: site.tools?.builtinTools?.knowledgeSearch ?? true },
      customTools: (site.tools?.customTools || []).map(
        (t: Record<string, unknown>) => ({
          name: (t.name as string) || "",
          description: (t.description as string) || "",
          parameters: (t.parameters as FormData["tools"]["customTools"][number]["parameters"]) || {
            type: "object" as const,
            properties: {},
            required: [],
          },
          endpoint: {
            url: ((t.endpoint as Record<string, unknown>)?.url as string) || "",
            method:
              ((t.endpoint as Record<string, unknown>)?.method as string) || "POST",
            headers:
              ((t.endpoint as Record<string, unknown>)?.headers as Record<string, string>) || {},
            timeoutMs:
              ((t.endpoint as Record<string, unknown>)?.timeoutMs as number) || 10000,
          },
        }),
      ),
    },
    rag: {
      enabled: site.knowledge?.rag?.enabled ?? false,
      chunkSize: site.knowledge?.rag?.chunkSize ?? 500,
      chunkOverlap: site.knowledge?.rag?.chunkOverlap ?? 50,
      topK: site.knowledge?.rag?.topK ?? 5,
      similarityThreshold: site.knowledge?.rag?.similarityThreshold ?? 0.3,
    },
    rateLimit: {
      messagesPerMinute: site.rateLimit?.messagesPerMinute ?? 10,
      messagesPerHour: site.rateLimit?.messagesPerHour ?? 100,
      messagesPerDay: site.rateLimit?.messagesPerDay ?? 1000,
    },
    compliance: {
      aiDisclosureEnabled: site.compliance?.aiDisclosureEnabled ?? true,
      aiDisclosureMessage:
        site.compliance?.aiDisclosureMessage || "You are chatting with an AI assistant.",
      conversationDeletionEnabled: site.compliance?.conversationDeletionEnabled ?? true,
    },
    conversationStarters: site.conversationStarters || [],
  };
}

export default function SiteEditPage() {
  const { siteId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    fetchSite(siteId)
      .then((data) => {
        if (!data) {
          setNotFound(true);
        } else {
          setForm(siteToForm(data));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [siteId]);

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
          No site with ID "{siteId}" exists.
        </p>
        <button
          type="button"
          onClick={() => navigate("/sites")}
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

  function updateTools<K extends keyof FormData["tools"]>(key: K, value: FormData["tools"][K]) {
    setForm((prev) => (prev ? { ...prev, tools: { ...prev.tools, [key]: value } } : prev));
  }

  function updateRag<K extends keyof FormData["rag"]>(key: K, value: FormData["rag"][K]) {
    setForm((prev) => (prev ? { ...prev, rag: { ...prev.rag, [key]: value } } : prev));
  }

  function updateCompliance<K extends keyof FormData["compliance"]>(
    key: K,
    value: FormData["compliance"][K],
  ) {
    setForm((prev) =>
      prev ? { ...prev, compliance: { ...prev.compliance, [key]: value } } : prev,
    );
  }

  function updatePersonality<K extends keyof FormData["personality"]>(
    key: K,
    value: FormData["personality"][K],
  ) {
    setForm((prev) =>
      prev ? { ...prev, personality: { ...prev.personality, [key]: value } } : prev,
    );
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
          bubbleIcon: form.branding.bubbleIcon,
          bubbleIconUrl: form.branding.bubbleIconUrl || undefined,
          bubbleSize: form.branding.bubbleSize,
          theme: form.branding.theme,
          borderRadius: form.branding.borderRadius,
          fontFamily: form.branding.fontFamily || undefined,
        },
        personality: form.personality,
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
          rag: form.rag,
        },
        tools: {
          enabled: form.tools.enabled,
          maxToolCalls: form.tools.maxToolCalls,
          builtinTools: form.tools.builtinTools,
          customTools: form.tools.customTools,
        },
        rateLimit: form.rateLimit,
        compliance: form.compliance,
        conversationStarters: form.conversationStarters.filter((s) => s.trim()),
      };

      await updateSite(form.siteId, payload);
      navigate("/sites");
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
      navigate("/sites");
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

        {/* Bubble Customization */}
        <Section title="Bubble Customization">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bubbleIcon" className={labelClass}>
                Bubble Icon
              </label>
              <select
                id="bubbleIcon"
                value={form.branding.bubbleIcon}
                onChange={(e) =>
                  updateBranding(
                    "bubbleIcon",
                    e.target.value as "chat" | "headset" | "robot" | "custom",
                  )
                }
                className={inputClass}
              >
                <option value="chat">Chat</option>
                <option value="headset">Headset</option>
                <option value="robot">Robot</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>
            <div>
              <label htmlFor="bubbleSize" className={labelClass}>
                Bubble Size
              </label>
              <select
                id="bubbleSize"
                value={form.branding.bubbleSize}
                onChange={(e) =>
                  updateBranding("bubbleSize", e.target.value as "sm" | "md" | "lg")
                }
                className={inputClass}
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>
          </div>
          {form.branding.bubbleIcon === "custom" && (
            <div>
              <label htmlFor="bubbleIconUrl" className={labelClass}>
                Custom Icon URL
              </label>
              <input
                id="bubbleIconUrl"
                type="url"
                value={form.branding.bubbleIconUrl}
                onChange={(e) => updateBranding("bubbleIconUrl", e.target.value)}
                placeholder="https://example.com/icon.svg"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL to a custom icon image (SVG or PNG recommended)
              </p>
            </div>
          )}
        </Section>

        {/* Theme */}
        <Section title="Theme">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="theme" className={labelClass}>
                Color Scheme
              </label>
              <select
                id="theme"
                value={form.branding.theme}
                onChange={(e) =>
                  updateBranding("theme", e.target.value as "light" | "dark" | "auto")
                }
                className={inputClass}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (follows system)</option>
              </select>
            </div>
            <div>
              <label htmlFor="borderRadius" className={labelClass}>
                Border Radius: {form.branding.borderRadius}px
              </label>
              <input
                id="borderRadius"
                type="range"
                min="0"
                max="24"
                step="1"
                value={form.branding.borderRadius}
                onChange={(e) =>
                  updateBranding("borderRadius", parseInt(e.target.value, 10))
                }
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0 (square)</span>
                <span>24 (round)</span>
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="fontFamily" className={labelClass}>
              Font Family
            </label>
            <input
              id="fontFamily"
              type="text"
              value={form.branding.fontFamily}
              onChange={(e) => updateBranding("fontFamily", e.target.value)}
              placeholder="Inter, system-ui, sans-serif"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty to use the default system font stack
            </p>
          </div>
        </Section>

        {/* Personality */}
        <Section title="Personality">
          <p className="text-xs text-muted-foreground mb-3">
            Control how the assistant communicates. These settings shape the tone and style of
            responses.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="personalityTone" className={labelClass}>
                Tone
              </label>
              <select
                id="personalityTone"
                value={form.personality.tone}
                onChange={(e) =>
                  updatePersonality(
                    "tone",
                    e.target.value as "friendly" | "professional" | "casual",
                  )
                }
                className={inputClass}
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <div>
              <label htmlFor="personalityFormality" className={labelClass}>
                Formality
              </label>
              <select
                id="personalityFormality"
                value={form.personality.formality}
                onChange={(e) =>
                  updatePersonality(
                    "formality",
                    e.target.value as "formal" | "informal" | "balanced",
                  )
                }
                className={inputClass}
              >
                <option value="formal">Formal</option>
                <option value="informal">Informal</option>
                <option value="balanced">Balanced</option>
              </select>
            </div>
            <div>
              <label htmlFor="personalityLength" className={labelClass}>
                Response Length
              </label>
              <select
                id="personalityLength"
                value={form.personality.responseLength}
                onChange={(e) =>
                  updatePersonality(
                    "responseLength",
                    e.target.value as "concise" | "balanced" | "detailed",
                  )
                }
                className={inputClass}
              >
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
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

        {/* Compliance (AI Act / GDPR) */}
        <Section title="Compliance">
          <p className="text-xs text-muted-foreground mb-3">
            EU AI Act Article 50 requires informing users they are interacting with AI.
            These settings help you comply.
          </p>
          <div className="flex items-center gap-3">
            <input
              id="aiDisclosureEnabled"
              type="checkbox"
              checked={form.compliance.aiDisclosureEnabled}
              onChange={(e) => updateCompliance("aiDisclosureEnabled", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
            />
            <div>
              <label htmlFor="aiDisclosureEnabled" className="text-sm font-medium">
                Show AI disclosure
              </label>
              <p className="text-xs text-muted-foreground">
                Display a notice that users are chatting with AI (required by EU AI Act Article 50, effective Aug 2, 2026)
              </p>
            </div>
          </div>
          {form.compliance.aiDisclosureEnabled && (
            <div>
              <label htmlFor="aiDisclosureMessage" className={labelClass}>
                Disclosure Message
              </label>
              <input
                id="aiDisclosureMessage"
                type="text"
                value={form.compliance.aiDisclosureMessage}
                onChange={(e) => updateCompliance("aiDisclosureMessage", e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              id="conversationDeletionEnabled"
              type="checkbox"
              checked={form.compliance.conversationDeletionEnabled}
              onChange={(e) =>
                updateCompliance("conversationDeletionEnabled", e.target.checked)
              }
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
            />
            <div>
              <label htmlFor="conversationDeletionEnabled" className="text-sm font-medium">
                Allow conversation deletion
              </label>
              <p className="text-xs text-muted-foreground">
                Show a delete button so users can erase their conversation data (GDPR right to erasure)
              </p>
            </div>
          </div>
        </Section>

        {/* Conversation Starters */}
        <Section title="Conversation Starters">
          <p className="text-xs text-muted-foreground mb-2">
            Suggested questions shown below the welcome message (max 4). Leave empty to disable.
          </p>
          {form.conversationStarters.map((starter, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={starter}
                onChange={(e) => {
                  const starters = [...form.conversationStarters];
                  starters[idx] = e.target.value;
                  setForm((prev) =>
                    prev ? { ...prev, conversationStarters: starters } : prev,
                  );
                }}
                placeholder={`Suggested question ${idx + 1}`}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => {
                  const starters = [...form.conversationStarters];
                  starters.splice(idx, 1);
                  setForm((prev) =>
                    prev ? { ...prev, conversationStarters: starters } : prev,
                  );
                }}
                className="text-xs text-red-500 hover:text-red-700 px-2"
              >
                x
              </button>
            </div>
          ))}
          {form.conversationStarters.length < 4 && (
            <button
              type="button"
              onClick={() => {
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        conversationStarters: [...prev.conversationStarters, ""],
                      }
                    : prev,
                );
              }}
              className="rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary w-full"
            >
              + Add Conversation Starter
            </button>
          )}
        </Section>

        {/* Knowledge Sources */}
        <Section title="Knowledge Sources">
          <p className="text-xs text-muted-foreground mb-2">
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
                    setForm((prev) =>
                      prev ? { ...prev, knowledge: { sources } } : prev,
                    );
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
                      setForm((prev) =>
                        prev ? { ...prev, knowledge: { sources } } : prev,
                      );
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
                      setForm((prev) =>
                        prev ? { ...prev, knowledge: { sources } } : prev,
                      );
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
                    setForm((prev) =>
                      prev ? { ...prev, knowledge: { sources } } : prev,
                    );
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
                      setForm((prev) =>
                        prev ? { ...prev, knowledge: { sources } } : prev,
                      );
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
                          setForm((prev) =>
                            prev ? { ...prev, knowledge: { sources } } : prev,
                          );
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
                          setForm((prev) =>
                            prev ? { ...prev, knowledge: { sources } } : prev,
                          );
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
                          setForm((prev) =>
                            prev ? { ...prev, knowledge: { sources } } : prev,
                          );
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
                      setForm((prev) =>
                        prev ? { ...prev, knowledge: { sources } } : prev,
                      );
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
              setForm((prev) =>
                prev
                  ? {
                      ...prev,
                      knowledge: {
                        sources: [
                          ...prev.knowledge.sources,
                          { type: "text", title: "", content: "", url: "", entries: [] },
                        ],
                      },
                    }
                  : prev,
              );
            }}
            className="rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary w-full"
          >
            + Add Knowledge Source
          </button>
        </Section>

        <Section title="RAG Configuration">
          <div className="flex items-center gap-3">
            <input
              id="ragEnabled"
              type="checkbox"
              checked={form.rag.enabled}
              onChange={(e) => updateRag("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
            />
            <div>
              <label htmlFor="ragEnabled" className="text-sm font-medium">
                Enable smart retrieval (RAG)
              </label>
              <p className="text-xs text-muted-foreground">
                Automatically chunk and search knowledge sources for relevant context before
                answering.
              </p>
            </div>
          </div>
          {form.rag.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ragChunkSize" className={labelClass}>
                  Chunk size: {form.rag.chunkSize}
                </label>
                <input
                  id="ragChunkSize"
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={form.rag.chunkSize}
                  onChange={(e) => updateRag("chunkSize", parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>100</span>
                  <span>2000</span>
                </div>
              </div>
              <div>
                <label htmlFor="ragChunkOverlap" className={labelClass}>
                  Chunk overlap: {form.rag.chunkOverlap}
                </label>
                <input
                  id="ragChunkOverlap"
                  type="range"
                  min="0"
                  max="500"
                  step="10"
                  value={form.rag.chunkOverlap}
                  onChange={(e) => updateRag("chunkOverlap", parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>500</span>
                </div>
              </div>
              <div>
                <label htmlFor="ragTopK" className={labelClass}>
                  Top K results: {form.rag.topK}
                </label>
                <input
                  id="ragTopK"
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={form.rag.topK}
                  onChange={(e) => updateRag("topK", parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>
              <div>
                <label htmlFor="ragSimilarity" className={labelClass}>
                  Similarity threshold: {form.rag.similarityThreshold}
                </label>
                <input
                  id="ragSimilarity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={form.rag.similarityThreshold}
                  onChange={(e) =>
                    updateRag("similarityThreshold", parseFloat(e.target.value))
                  }
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>1</span>
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section title="Agent Tools">
          <div className="flex items-center gap-3">
            <input
              id="toolsEnabled"
              type="checkbox"
              checked={form.tools.enabled}
              onChange={(e) => updateTools("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
            />
            <label htmlFor="toolsEnabled" className="text-sm font-medium">
              Enable agent mode
            </label>
          </div>
          {form.tools.enabled && (
            <div className="space-y-4">
              <div>
                <p className={labelClass}>Built-in Tools</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      id="toolKnowledgeSearch"
                      type="checkbox"
                      checked={form.tools.builtinTools.knowledgeSearch}
                      onChange={(e) =>
                        updateTools("builtinTools", {
                          ...form.tools.builtinTools,
                          knowledgeSearch: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
                    />
                    <label htmlFor="toolKnowledgeSearch" className="text-sm">
                      Knowledge search
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create ticket auto-enables when ticket providers are configured.
                  </p>
                </div>
              </div>
              <div>
                <label htmlFor="maxToolCalls" className={labelClass}>
                  Max tool calls: {form.tools.maxToolCalls}
                </label>
                <input
                  id="maxToolCalls"
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={form.tools.maxToolCalls}
                  onChange={(e) =>
                    updateTools("maxToolCalls", parseInt(e.target.value, 10))
                  }
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
              <div>
                <p className={labelClass}>Custom Tools</p>
                <div className="space-y-3">
                  {form.tools.customTools.map((tool, tIdx) => (
                    <div
                      key={tIdx}
                      className="rounded-lg border border-border p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Tool #{tIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const customTools = [...form.tools.customTools];
                            customTools.splice(tIdx, 1);
                            updateTools("customTools", customTools);
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove tool
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Name</label>
                          <input
                            type="text"
                            value={tool.name}
                            onChange={(e) => {
                              const customTools = [...form.tools.customTools];
                              customTools[tIdx] = {
                                ...customTools[tIdx],
                                name: e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9_-]/g, "-"),
                              };
                              updateTools("customTools", customTools);
                            }}
                            placeholder="my-tool"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Endpoint URL</label>
                          <input
                            type="text"
                            value={tool.endpoint.url}
                            onChange={(e) => {
                              const customTools = [...form.tools.customTools];
                              customTools[tIdx] = {
                                ...customTools[tIdx],
                                endpoint: { ...customTools[tIdx].endpoint, url: e.target.value },
                              };
                              updateTools("customTools", customTools);
                            }}
                            placeholder="https://api.example.com/action"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <textarea
                          rows={2}
                          value={tool.description}
                          onChange={(e) => {
                            const customTools = [...form.tools.customTools];
                            customTools[tIdx] = {
                              ...customTools[tIdx],
                              description: e.target.value,
                            };
                            updateTools("customTools", customTools);
                          }}
                          placeholder="What does this tool do?"
                          className={inputClass}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>HTTP Method</label>
                          <select
                            value={tool.endpoint.method}
                            onChange={(e) => {
                              const customTools = [...form.tools.customTools];
                              customTools[tIdx] = {
                                ...customTools[tIdx],
                                endpoint: {
                                  ...customTools[tIdx].endpoint,
                                  method: e.target.value as "GET" | "POST" | "PUT" | "PATCH",
                                },
                              };
                              updateTools("customTools", customTools);
                            }}
                            className={inputClass}
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Timeout (ms)</label>
                          <input
                            type="number"
                            min={1000}
                            max={60000}
                            value={tool.endpoint.timeoutMs}
                            onChange={(e) => {
                              const customTools = [...form.tools.customTools];
                              customTools[tIdx] = {
                                ...customTools[tIdx],
                                endpoint: {
                                  ...customTools[tIdx].endpoint,
                                  timeoutMs: parseInt(e.target.value, 10) || 10000,
                                },
                              };
                              updateTools("customTools", customTools);
                            }}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div>
                        <p className={labelClass}>Parameters</p>
                        <div className="space-y-2">
                          {Object.entries(tool.parameters.properties).map(
                            ([paramName, paramDef]) => (
                              <div key={paramName} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={paramName}
                                  onChange={(e) => {
                                    const customTools = [...form.tools.customTools];
                                    const oldProps = { ...customTools[tIdx].parameters.properties };
                                    const val = oldProps[paramName];
                                    delete oldProps[paramName];
                                    oldProps[e.target.value] = val;
                                    const required = customTools[tIdx].parameters.required.map(
                                      (r) => (r === paramName ? e.target.value : r),
                                    );
                                    customTools[tIdx] = {
                                      ...customTools[tIdx],
                                      parameters: {
                                        ...customTools[tIdx].parameters,
                                        properties: oldProps,
                                        required,
                                      },
                                    };
                                    updateTools("customTools", customTools);
                                  }}
                                  placeholder="name"
                                  className={`${inputClass} flex-1`}
                                />
                                <select
                                  value={paramDef.type}
                                  onChange={(e) => {
                                    const customTools = [...form.tools.customTools];
                                    const props = { ...customTools[tIdx].parameters.properties };
                                    props[paramName] = { ...props[paramName], type: e.target.value };
                                    customTools[tIdx] = {
                                      ...customTools[tIdx],
                                      parameters: {
                                        ...customTools[tIdx].parameters,
                                        properties: props,
                                      },
                                    };
                                    updateTools("customTools", customTools);
                                  }}
                                  className={`${inputClass} w-28`}
                                >
                                  <option value="string">string</option>
                                  <option value="number">number</option>
                                  <option value="integer">integer</option>
                                  <option value="boolean">boolean</option>
                                </select>
                                <input
                                  type="text"
                                  value={paramDef.description}
                                  onChange={(e) => {
                                    const customTools = [...form.tools.customTools];
                                    const props = { ...customTools[tIdx].parameters.properties };
                                    props[paramName] = {
                                      ...props[paramName],
                                      description: e.target.value,
                                    };
                                    customTools[tIdx] = {
                                      ...customTools[tIdx],
                                      parameters: {
                                        ...customTools[tIdx].parameters,
                                        properties: props,
                                      },
                                    };
                                    updateTools("customTools", customTools);
                                  }}
                                  placeholder="description"
                                  className={`${inputClass} flex-1`}
                                />
                                <div className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={tool.parameters.required.includes(paramName)}
                                    onChange={(e) => {
                                      const customTools = [...form.tools.customTools];
                                      let required = [...customTools[tIdx].parameters.required];
                                      if (e.target.checked) {
                                        required.push(paramName);
                                      } else {
                                        required = required.filter((r) => r !== paramName);
                                      }
                                      customTools[tIdx] = {
                                        ...customTools[tIdx],
                                        parameters: {
                                          ...customTools[tIdx].parameters,
                                          required,
                                        },
                                      };
                                      updateTools("customTools", customTools);
                                    }}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
                                  />
                                  <span className="text-xs text-muted-foreground">req</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const customTools = [...form.tools.customTools];
                                    const props = { ...customTools[tIdx].parameters.properties };
                                    delete props[paramName];
                                    const required = customTools[tIdx].parameters.required.filter(
                                      (r) => r !== paramName,
                                    );
                                    customTools[tIdx] = {
                                      ...customTools[tIdx],
                                      parameters: {
                                        ...customTools[tIdx].parameters,
                                        properties: props,
                                        required,
                                      },
                                    };
                                    updateTools("customTools", customTools);
                                  }}
                                  className="text-xs text-red-500 hover:text-red-700 px-1"
                                >
                                  x
                                </button>
                              </div>
                            ),
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const customTools = [...form.tools.customTools];
                              const props = { ...customTools[tIdx].parameters.properties };
                              const key = `param${Object.keys(props).length + 1}`;
                              props[key] = { type: "string", description: "" };
                              customTools[tIdx] = {
                                ...customTools[tIdx],
                                parameters: {
                                  ...customTools[tIdx].parameters,
                                  properties: props,
                                },
                              };
                              updateTools("customTools", customTools);
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            + Add parameter
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      updateTools("customTools", [
                        ...form.tools.customTools,
                        {
                          name: "",
                          description: "",
                          parameters: { type: "object", properties: {}, required: [] },
                          endpoint: { url: "", method: "POST", headers: {}, timeoutMs: 10000 },
                        },
                      ]);
                    }}
                    className="rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary w-full"
                  >
                    + Add Custom Tool
                  </button>
                </div>
              </div>
            </div>
          )}
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
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/sites")}
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
