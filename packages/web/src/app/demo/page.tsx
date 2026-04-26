"use client";

import { useState, useCallback } from "react";

const SAMPLE_MESSAGES = [
  { role: "user" as const, text: "Hi there!" },
  { role: "assistant" as const, text: "Hello! How can I help you today?" },
  { role: "user" as const, text: "I have a question about your product." },
  {
    role: "assistant" as const,
    text: "Of course! I'd be happy to help. What would you like to know?",
  },
];

const COLOR_PRESETS = [
  { name: "Indigo", primary: "#6366f1" },
  { name: "Emerald", primary: "#10b981" },
  { name: "Rose", primary: "#f43f5e" },
  { name: "Amber", primary: "#f59e0b" },
  { name: "Sky", primary: "#0ea5e9" },
  { name: "Violet", primary: "#8b5cf6" },
  { name: "Slate", primary: "#475569" },
  { name: "Orange", primary: "#f97316" },
];

function generateEmbedCode(options: {
  siteId: string;
  useKodyConfig: boolean;
  name: string;
  primaryColor: string;
  position: string;
  welcomeMessage: string;
}) {
  if (options.useKodyConfig) {
    return `<script>
  window.KodyConfig = {
    siteId: "${options.siteId || "your-site-id"}",
    name: "${options.name}",
    primaryColor: "${options.primaryColor}",
    position: "${options.position}"
  };
</script>
<script src="https://kody.codai.app/widget.js" async></script>`;
  }
  return `<script
  src="https://kody.codai.app/widget.js"
  data-site-id="${options.siteId || "your-site-id"}"
  async
></script>`;
}

export default function DemoPage() {
  const [siteName, setSiteName] = useState("Assistant");
  const [siteId, setSiteId] = useState("my-site");
  const [welcomeMessage, setWelcomeMessage] = useState("Hi there! How can I help you today?");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [foregroundColor, setForegroundColor] = useState("#1f2937");
  const [bubbleBackground, setBubbleBackground] = useState("#f3f4f6");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your message...");
  const [chatOpen, setChatOpen] = useState(false);
  const [useKodyConfig, setUseKodyConfig] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"branding" | "colors" | "embed">("branding");

  const embedCode = generateEmbedCode({
    siteId,
    useKodyConfig,
    name: siteName,
    primaryColor,
    position,
    welcomeMessage,
  });

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [embedCode]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Interactive Demo</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Configure the widget branding, colors, and position, then see a live preview. When you are
          happy, copy the embed code and add it to your site.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Left panel: Config form */}
        <div className="rounded-xl border border-border bg-background p-6 sm:p-8">
          <h2 className="mb-6 text-xl font-semibold">Configuration</h2>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setActiveTab("branding")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "branding"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Branding
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("colors")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "colors"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Colors
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("embed")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "embed"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Embed
            </button>
          </div>

          {/* Branding tab */}
          {activeTab === "branding" && (
            <div className="space-y-5">
              {/* Site name */}
              <div>
                <label htmlFor="site-name" className="mb-1.5 block text-sm font-medium">
                  Assistant Name
                </label>
                <input
                  id="site-name"
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                  placeholder="Assistant"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown in the widget header. Also used to replace AI provider names in responses.
                </p>
              </div>

              {/* Welcome message */}
              <div>
                <label htmlFor="welcome-msg" className="mb-1.5 block text-sm font-medium">
                  Welcome Message
                </label>
                <textarea
                  id="welcome-msg"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                  placeholder="Hi there! How can I help you today?"
                />
              </div>

              {/* Input placeholder */}
              <div>
                <label htmlFor="input-placeholder" className="mb-1.5 block text-sm font-medium">
                  Input Placeholder
                </label>
                <input
                  id="input-placeholder"
                  type="text"
                  value={inputPlaceholder}
                  onChange={(e) => setInputPlaceholder(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                  placeholder="Type your message..."
                />
              </div>

              {/* Position */}
              <div>
                <span className="mb-1.5 block text-sm font-medium">Position</span>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="position"
                      value="bottom-right"
                      checked={position === "bottom-right"}
                      onChange={() => setPosition("bottom-right")}
                      className="accent-primary"
                    />
                    Bottom Right
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="position"
                      value="bottom-left"
                      checked={position === "bottom-left"}
                      onChange={() => setPosition("bottom-left")}
                      className="accent-primary"
                    />
                    Bottom Left
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Colors tab */}
          {activeTab === "colors" && (
            <div className="space-y-5">
              {/* Color presets */}
              <div>
                <span className="mb-2 block text-sm font-medium">Quick Presets</span>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setPrimaryColor(preset.primary)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        primaryColor === preset.primary
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: preset.primary }}
                      />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary color */}
              <div>
                <label htmlFor="primary-color" className="mb-1.5 block text-sm font-medium">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-border"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-24 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                    placeholder="#6366f1"
                  />
                  <span className="text-xs text-muted-foreground">
                    Header, bubble, user messages
                  </span>
                </div>
              </div>

              {/* Background color */}
              <div>
                <label htmlFor="bg-color" className="mb-1.5 block text-sm font-medium">
                  Background Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="bg-color"
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-border"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-24 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                    placeholder="#ffffff"
                  />
                  <span className="text-xs text-muted-foreground">Chat area background</span>
                </div>
              </div>

              {/* Foreground color */}
              <div>
                <label htmlFor="fg-color" className="mb-1.5 block text-sm font-medium">
                  Text Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="fg-color"
                    type="color"
                    value={foregroundColor}
                    onChange={(e) => setForegroundColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-border"
                  />
                  <input
                    type="text"
                    value={foregroundColor}
                    onChange={(e) => setForegroundColor(e.target.value)}
                    className="w-24 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                    placeholder="#1f2937"
                  />
                  <span className="text-xs text-muted-foreground">Assistant text color</span>
                </div>
              </div>

              {/* Bubble background */}
              <div>
                <label htmlFor="bubble-bg" className="mb-1.5 block text-sm font-medium">
                  Assistant Bubble Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="bubble-bg"
                    type="color"
                    value={bubbleBackground}
                    onChange={(e) => setBubbleBackground(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-border"
                  />
                  <input
                    type="text"
                    value={bubbleBackground}
                    onChange={(e) => setBubbleBackground(e.target.value)}
                    className="w-24 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                    placeholder="#f3f4f6"
                  />
                  <span className="text-xs text-muted-foreground">Assistant message bubbles</span>
                </div>
              </div>
            </div>
          )}

          {/* Embed tab */}
          {activeTab === "embed" && (
            <div className="space-y-5">
              {/* Site ID */}
              <div>
                <label htmlFor="site-id" className="mb-1.5 block text-sm font-medium">
                  Site ID
                </label>
                <input
                  id="site-id"
                  type="text"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                  placeholder="my-site"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The siteId you created in the admin dashboard. Lowercase alphanumeric with
                  hyphens.
                </p>
              </div>

              {/* Embed method */}
              <div>
                <span className="mb-1.5 block text-sm font-medium">Embed Method</span>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="embed-method"
                      checked={!useKodyConfig}
                      onChange={() => setUseKodyConfig(false)}
                      className="accent-primary"
                    />
                    Script tag (simple)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="embed-method"
                      checked={useKodyConfig}
                      onChange={() => setUseKodyConfig(true)}
                      className="accent-primary"
                    />
                    window.KodyConfig
                  </label>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {useKodyConfig
                    ? "Client-side config lets you override branding per page. Server config takes precedence for non-branding settings."
                    : "Simplest option: one script tag with a data-site-id attribute. All config comes from the server."}
                </p>
              </div>

              {/* Generated code */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium">Embed Code</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    {copied ? (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
                  <code>{embedCode}</code>
                </pre>
              </div>

              {/* Info note */}
              <div className="rounded-lg bg-muted/60 p-4">
                <p className="text-sm text-muted-foreground">
                  This code connects to{" "}
                  <a
                    href="https://kody.codai.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    kody.codai.app
                  </a>
                  . For self-hosted deployments, replace the script{" "}
                  <code className="text-xs">src</code> URL with your own server address.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Live preview */}
        <div className="relative rounded-xl border border-border bg-muted/30 p-6 sm:p-8">
          <h2 className="mb-6 text-xl font-semibold">Preview</h2>

          {/* Preview container */}
          <div className="relative min-h-[480px] overflow-hidden rounded-xl border border-border bg-background">
            {/* Simulated page content */}
            <div className="p-6">
              <div className="mb-4 h-4 w-3/4 rounded bg-muted" />
              <div className="mb-3 h-3 w-full rounded bg-muted" />
              <div className="mb-3 h-3 w-5/6 rounded bg-muted" />
              <div className="mb-3 h-3 w-4/6 rounded bg-muted" />
              <div className="mb-6 h-3 w-2/3 rounded bg-muted" />
              <div className="mb-4 h-4 w-1/2 rounded bg-muted" />
              <div className="mb-3 h-3 w-full rounded bg-muted" />
              <div className="mb-3 h-3 w-5/6 rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
            </div>

            {/* Chat window (when open) */}
            {chatOpen && (
              <div
                className="absolute bottom-20 w-[320px] overflow-hidden rounded-2xl shadow-2xl"
                style={{
                  [position === "bottom-right" ? "right" : "left"]: "16px",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    backgroundColor: primaryColor,
                    color: "#ffffff",
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                    {siteName.charAt(0).toUpperCase() || "A"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{siteName || "Assistant"}</div>
                    <div className="text-xs opacity-80">Online</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    className="ml-auto text-white/80 transition-colors hover:text-white"
                    aria-label="Close chat"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Messages area */}
                <div
                  className="flex flex-col gap-3 p-4"
                  style={{
                    backgroundColor,
                    maxHeight: "260px",
                    overflowY: "auto",
                  }}
                >
                  {/* Welcome message */}
                  {welcomeMessage && (
                    <div
                      className="rounded-lg px-3 py-2 text-center text-xs"
                      style={{
                        backgroundColor: bubbleBackground,
                        color: foregroundColor,
                        opacity: 0.7,
                      }}
                    >
                      {welcomeMessage}
                    </div>
                  )}

                  {SAMPLE_MESSAGES.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className="max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed"
                        style={
                          msg.role === "user"
                            ? {
                                backgroundColor: primaryColor,
                                color: "#ffffff",
                              }
                            : {
                                backgroundColor: bubbleBackground,
                                color: foregroundColor,
                              }
                        }
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input bar */}
                <div
                  className="flex items-center gap-2 border-t border-border px-3 py-2.5"
                  style={{ backgroundColor }}
                >
                  <div
                    className="flex-1 rounded-full px-3.5 py-2 text-xs"
                    style={{
                      backgroundColor: bubbleBackground,
                      color: foregroundColor,
                      opacity: 0.5,
                    }}
                  >
                    {inputPlaceholder}
                  </div>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Bubble button */}
            <button
              type="button"
              onClick={() => setChatOpen((o) => !o)}
              className="absolute bottom-4 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
              style={{
                backgroundColor: primaryColor,
                [position === "bottom-right" ? "right" : "left"]: "16px",
              }}
              aria-label={chatOpen ? "Close chat" : "Open chat"}
            >
              {chatOpen ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* Preview note */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            This is a visual mockup. In production, the widget connects to your AI backend and
            responds to real conversations.
          </p>
        </div>
      </div>

      {/* Embed CTA */}
      <section className="mt-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to use Kody?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Add the widget to your site with a single script tag. Open source, self-hosted, and free
          under the MIT license.
        </p>

        <div className="mx-auto mt-8 max-w-2xl overflow-x-auto rounded-xl border border-border bg-muted/60 px-6 py-4 text-left">
          <div className="flex items-center justify-between">
            <pre className="text-sm leading-relaxed text-muted-foreground">
              <code>{`<script src="https://kody.codai.app/widget.js"
       data-site-id="your-site-id"
       async></script>`}</code>
            </pre>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  `<script src="https://kody.codai.app/widget.js" data-site-id="your-site-id" async></script>`,
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="ml-4 shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="/docs/getting-started"
            className="rounded-lg bg-primary px-7 py-3 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
          >
            Get Started
          </a>
          <a
            href="/docs"
            className="rounded-lg border border-border px-7 py-3 text-base font-semibold transition-colors hover:bg-muted"
          >
            Read the Docs
          </a>
          <a
            href="https://github.com/chafficui/kody"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-7 py-3 text-base font-semibold transition-colors hover:bg-muted"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
