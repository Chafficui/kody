export default function ConfigurationPage() {
  return (
    <article>
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Configuration</h1>
      <p className="mb-10 text-lg text-muted-foreground">
        Complete reference for site configuration options. All fields are validated against a Zod
        schema on the server. Required fields are marked; everything else has sensible defaults.
      </p>

      {/* Top-level */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Site Config (top level)</h2>
        <p className="mb-4 text-foreground">
          The top-level object passed when creating or updating a site via the admin API or
          dashboard.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">siteId</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Unique identifier. Lowercase alphanumeric with hyphens only (
                  <code className="text-xs">^[a-z0-9-]+$</code>), 1-100 chars.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">allowedOrigins</td>
                <td className="py-2 pr-4">string[]</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  URLs allowed to load the widget. Must be valid URLs. At least one required. The
                  server checks the <code className="text-xs">Origin</code> header against this
                  list.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">enabled</td>
                <td className="py-2 pr-4">boolean</td>
                <td className="py-2 pr-4">true</td>
                <td className="py-2">
                  Enable or disable the site. Disabled sites reject all widget requests.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">branding</td>
                <td className="py-2 pr-4">object</td>
                <td className="py-2 pr-4">{"{}"}</td>
                <td className="py-2">
                  Widget appearance and text. See{" "}
                  <a href="#branding" className="text-primary underline underline-offset-2">
                    branding
                  </a>{" "}
                  below.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">ai</td>
                <td className="py-2 pr-4">object</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  AI provider configuration. See{" "}
                  <a href="#ai" className="text-primary underline underline-offset-2">
                    ai
                  </a>{" "}
                  below.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">guardrails</td>
                <td className="py-2 pr-4">object</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Security and topic guardrails. See{" "}
                  <a href="#guardrails" className="text-primary underline underline-offset-2">
                    guardrails
                  </a>{" "}
                  below.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">knowledge</td>
                <td className="py-2 pr-4">object</td>
                <td className="py-2 pr-4">{"{}"}</td>
                <td className="py-2">
                  Knowledge sources for context. See{" "}
                  <a href="#knowledge" className="text-primary underline underline-offset-2">
                    knowledge
                  </a>{" "}
                  below.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">tickets</td>
                <td className="py-2 pr-4">object</td>
                <td className="py-2 pr-4">{"{}"}</td>
                <td className="py-2">
                  Ticket creation settings. See{" "}
                  <a href="#tickets" className="text-primary underline underline-offset-2">
                    tickets
                  </a>{" "}
                  below.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">rateLimit</td>
                <td className="py-2 pr-4">object</td>
                <td className="py-2 pr-4">{"{}"}</td>
                <td className="py-2">
                  Per-IP rate limiting. See{" "}
                  <a href="#ratelimit" className="text-primary underline underline-offset-2">
                    rateLimit
                  </a>{" "}
                  below.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Branding */}
      <section className="mb-10" id="branding">
        <h2 className="mb-4 text-2xl font-semibold">branding</h2>
        <p className="mb-4 text-foreground">
          Controls the widget&apos;s visual appearance, text, and position. All fields are optional
          with sensible defaults. The branding object is sent to the client as part of the public
          config &mdash; no secrets are exposed.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">name</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&quot;Assistant&quot;</td>
                <td className="py-2">
                  Display name shown in the widget header and used as the replacement when scrubbing
                  AI provider names from responses. 1-100 chars.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">tagline</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">Short tagline below the name. Up to 200 chars. Optional.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">logoUrl</td>
                <td className="py-2 pr-4">string (URL)</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  URL to a logo image displayed in the widget header. Must be a valid URL. Optional.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">colors.primary</td>
                <td className="py-2 pr-4">hex color</td>
                <td className="py-2 pr-4">#6366f1</td>
                <td className="py-2">
                  Primary accent color. Used for the header, bubble button, and user message
                  background.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">colors.primaryForeground</td>
                <td className="py-2 pr-4">hex color</td>
                <td className="py-2 pr-4">#ffffff</td>
                <td className="py-2">
                  Text color on primary-colored backgrounds (header, bubble button).
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">colors.background</td>
                <td className="py-2 pr-4">hex color</td>
                <td className="py-2 pr-4">#ffffff</td>
                <td className="py-2">Widget background color for the chat area and input bar.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">colors.foreground</td>
                <td className="py-2 pr-4">hex color</td>
                <td className="py-2 pr-4">#1f2937</td>
                <td className="py-2">
                  Primary text color used for assistant messages and general text.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">colors.bubbleBackground</td>
                <td className="py-2 pr-4">hex color</td>
                <td className="py-2 pr-4">#f3f4f6</td>
                <td className="py-2">Background color for assistant message bubbles.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">colors.userBubbleBackground</td>
                <td className="py-2 pr-4">hex color</td>
                <td className="py-2 pr-4">#6366f1</td>
                <td className="py-2">Background color for user message bubbles.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">colors.userBubbleForeground</td>
                <td className="py-2 pr-4">hex color</td>
                <td className="py-2 pr-4">#ffffff</td>
                <td className="py-2">Text color inside user message bubbles.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">position</td>
                <td className="py-2 pr-4">enum</td>
                <td className="py-2 pr-4">&quot;bottom-right&quot;</td>
                <td className="py-2">
                  Widget position: <code className="text-xs">&quot;bottom-right&quot;</code> or{" "}
                  <code className="text-xs">&quot;bottom-left&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">welcomeMessage</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&quot;Hi! How can I help you today?&quot;</td>
                <td className="py-2">
                  First message shown when the user opens the chat window. Up to 500 chars.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">inputPlaceholder</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&quot;Type your message...&quot;</td>
                <td className="py-2">
                  Placeholder text in the message input field. Up to 200 chars.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Note:</strong> All color values must be 6-digit hex
          strings (e.g. <code className="text-xs">#6366f1</code>). Shorthand hex (
          <code className="text-xs">#fff</code>) and named colors are not accepted.
        </div>
      </section>

      {/* AI */}
      <section className="mb-10" id="ai">
        <h2 className="mb-4 text-2xl font-semibold">ai</h2>
        <p className="mb-4 text-foreground">
          Kody works with any OpenAI-compatible chat completions API. This includes Ollama, vLLM,
          llama.cpp, OpenAI, and many other providers. The AI config is stored server-side only
          &mdash; API keys are never sent to the browser.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">baseUrl</td>
                <td className="py-2 pr-4">string (URL)</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  OpenAI-compatible API base URL. Examples:{" "}
                  <code className="text-xs">http://localhost:11434/v1</code> (Ollama),{" "}
                  <code className="text-xs">https://api.openai.com/v1</code> (OpenAI).
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">apiKey</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&quot;ollama&quot;</td>
                <td className="py-2">
                  API key sent in the <code className="text-xs">Authorization: Bearer</code> header.
                  For Ollama, any non-empty string works. Min 1 char.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">model</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Model name to request from the provider. Examples:{" "}
                  <code className="text-xs">llama3</code>, <code className="text-xs">gpt-4o</code>,{" "}
                  <code className="text-xs">mistral</code>. Min 1 char.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">temperature</td>
                <td className="py-2 pr-4">number</td>
                <td className="py-2 pr-4">0.7</td>
                <td className="py-2">
                  Sampling temperature controlling response randomness. Range: 0 (deterministic) to
                  2 (very creative).
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">maxTokens</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">1024</td>
                <td className="py-2">Maximum tokens in the AI response. Range: 1-32768.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">topP</td>
                <td className="py-2 pr-4">number</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Nucleus sampling parameter. Range: 0-1. Optional. Only set this if you know what
                  you are doing &mdash; most use cases are better served by adjusting temperature
                  alone.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">systemPromptPrefix</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Custom text appended to the auto-generated system prompt under an &quot;ADDITIONAL
                  INSTRUCTIONS&quot; section. Up to 4000 chars. Use this to give the AI extra
                  persona details or behavioral instructions.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Provider examples:</strong>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Ollama:</strong>{" "}
              <code className="text-xs">baseUrl: &quot;http://localhost:11434/v1&quot;</code>,{" "}
              <code className="text-xs">apiKey: &quot;ollama&quot;</code>
            </li>
            <li>
              <strong>OpenAI:</strong>{" "}
              <code className="text-xs">baseUrl: &quot;https://api.openai.com/v1&quot;</code>,{" "}
              <code className="text-xs">apiKey: &quot;sk-...&quot;</code>
            </li>
            <li>
              <strong>vLLM:</strong>{" "}
              <code className="text-xs">baseUrl: &quot;http://localhost:8000/v1&quot;</code>,{" "}
              <code className="text-xs">apiKey: &quot;token&quot;</code>
            </li>
            <li>
              <strong>llama.cpp:</strong>{" "}
              <code className="text-xs">baseUrl: &quot;http://localhost:8080/v1&quot;</code>,{" "}
              <code className="text-xs">apiKey: &quot;token&quot;</code>
            </li>
          </ul>
        </div>
      </section>

      {/* Guardrails */}
      <section className="mb-10" id="guardrails">
        <h2 className="mb-4 text-2xl font-semibold">guardrails</h2>
        <p className="mb-4 text-foreground">
          Controls security filtering and topic restrictions. For a deep dive, see the{" "}
          <a
            href="/docs/security"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Security
          </a>{" "}
          page.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">allowedTopics</td>
                <td className="py-2 pr-4">string[]</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Topics the assistant is allowed to discuss. At least one required. Each string
                  1-200 chars. Injected into the system prompt as allowed topics.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">topicDescription</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Human-readable description of what the assistant should help with. Injected into
                  the system prompt. 1-4000 chars.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">refusalMessage</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">
                  &quot;I can only help with topics related to this website...&quot;
                </td>
                <td className="py-2">
                  Message the AI is instructed to use when refusing off-topic requests. Up to 500
                  chars.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">blockedInputPatterns</td>
                <td className="py-2 pr-4">string[]</td>
                <td className="py-2 pr-4">[]</td>
                <td className="py-2">
                  Additional regex patterns to block in user input (on top of the 17 built-in prompt
                  injection patterns). Each is tested case-insensitively.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">blockedOutputPatterns</td>
                <td className="py-2 pr-4">string[]</td>
                <td className="py-2 pr-4">[]</td>
                <td className="py-2">
                  Regex patterns to block in AI responses. If a response matches any pattern, it is
                  blocked entirely and not sent to the user.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">maxInputLength</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">2000</td>
                <td className="py-2">Maximum user message length in characters. Range: 1-10000.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">enablePromptInjectionDetection</td>
                <td className="py-2 pr-4">boolean</td>
                <td className="py-2 pr-4">true</td>
                <td className="py-2">
                  Enable built-in prompt injection pattern detection. Checks for instruction
                  overrides, role switching, mode escalation, system prompt extraction, and format
                  injection.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">enableOutputScrubbing</td>
                <td className="py-2 pr-4">boolean</td>
                <td className="py-2 pr-4">true</td>
                <td className="py-2">
                  Scrub 30+ AI provider names from responses and detect system prompt leaks.
                  Strongly recommended to keep enabled.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Knowledge */}
      <section className="mb-10" id="knowledge">
        <h2 className="mb-4 text-2xl font-semibold">knowledge</h2>
        <p className="mb-4 text-foreground">
          Provides contextual information to the AI via the system prompt. For details on each
          source type, see{" "}
          <a
            href="/docs/knowledge-sources"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Knowledge Sources
          </a>
          .
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">sources</td>
                <td className="py-2 pr-4">KnowledgeSource[]</td>
                <td className="py-2 pr-4">[]</td>
                <td className="py-2">
                  Array of knowledge sources. Supports 4 types:{" "}
                  <code className="text-xs">text</code>, <code className="text-xs">faq</code>,{" "}
                  <code className="text-xs">url</code>, <code className="text-xs">file</code>. See{" "}
                  <a
                    href="/docs/knowledge-sources"
                    className="text-primary underline underline-offset-2"
                  >
                    Knowledge Sources
                  </a>
                  .
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">maxContextTokens</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">4000</td>
                <td className="py-2">
                  Token budget for knowledge context injected into the system prompt. Range:
                  100-32000. Higher values increase AI costs and latency.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Tickets */}
      <section className="mb-10" id="tickets">
        <h2 className="mb-4 text-2xl font-semibold">tickets</h2>
        <p className="mb-4 text-foreground">
          Enable users to create support tickets from the chat widget. For provider-specific setup,
          see{" "}
          <a
            href="/docs/ticket-providers"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Ticket Providers
          </a>
          .
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">enabled</td>
                <td className="py-2 pr-4">boolean</td>
                <td className="py-2 pr-4">false</td>
                <td className="py-2">
                  Enable ticket creation from the widget. Shows a ticket button in the chat UI.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">promptMessage</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">
                  &quot;Would you like me to create a support ticket...&quot;
                </td>
                <td className="py-2">
                  Message prompting the user to create a ticket. Up to 500 chars.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">providers</td>
                <td className="py-2 pr-4">TicketProvider[]</td>
                <td className="py-2 pr-4">[]</td>
                <td className="py-2">
                  Array of ticket providers. Supports 5 types: <code className="text-xs">jira</code>
                  , <code className="text-xs">github</code>, <code className="text-xs">linear</code>
                  , <code className="text-xs">email</code>, <code className="text-xs">webhook</code>
                  . Tickets are sent to all configured providers. See{" "}
                  <a
                    href="/docs/ticket-providers"
                    className="text-primary underline underline-offset-2"
                  >
                    Ticket Providers
                  </a>
                  .
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">requiredFields</td>
                <td className="py-2 pr-4">string[]</td>
                <td className="py-2 pr-4">[&quot;email&quot;, &quot;description&quot;]</td>
                <td className="py-2">
                  Fields the user must fill in to submit a ticket. Valid values:{" "}
                  <code className="text-xs">&quot;name&quot;</code>,{" "}
                  <code className="text-xs">&quot;email&quot;</code>,{" "}
                  <code className="text-xs">&quot;subject&quot;</code>,{" "}
                  <code className="text-xs">&quot;description&quot;</code>.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Rate Limit */}
      <section className="mb-10" id="ratelimit">
        <h2 className="mb-4 text-2xl font-semibold">rateLimit</h2>
        <p className="mb-4 text-foreground">
          Per-IP rate limiting to protect your AI backend from abuse. All limits are enforced
          server-side.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">messagesPerMinute</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">10</td>
                <td className="py-2">Max messages per IP per minute. Range: 1-120.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">messagesPerHour</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">100</td>
                <td className="py-2">Max messages per IP per hour. Range: 1-1000.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">messagesPerDay</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">1000</td>
                <td className="py-2">Max messages per IP per day. Range: 1-10000.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Embedding methods */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Embedding the Widget</h2>
        <p className="mb-4 text-foreground">There are two ways to embed the widget on your page:</p>

        <h3 className="mb-3 text-lg font-semibold">1. Script tag with data attributes</h3>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`<script
  src="https://kody.codai.app/widget.js"
  data-site-id="your-site-id"
  async
></script>`}</code>
        </pre>

        <h3 className="mb-3 mt-6 text-lg font-semibold">2. window.KodyConfig</h3>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`<script>
  window.KodyConfig = {
    siteId: "your-site-id",
    position: "bottom-left",
    name: "Support Bot",
    primaryColor: "#10b981"
  };
</script>
<script src="https://kody.codai.app/widget.js" async></script>`}</code>
        </pre>
      </section>

      {/* Full example */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Complete Example</h2>
        <p className="mb-4 text-foreground">
          A full site configuration using all available options:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "siteId": "my-docs",
  "allowedOrigins": ["https://example.com", "https://www.example.com"],
  "enabled": true,
  "branding": {
    "name": "DocBot",
    "tagline": "Your documentation assistant",
    "logoUrl": "https://example.com/logo.png",
    "colors": {
      "primary": "#6366f1",
      "primaryForeground": "#ffffff",
      "background": "#ffffff",
      "foreground": "#1f2937",
      "bubbleBackground": "#f3f4f6",
      "userBubbleBackground": "#6366f1",
      "userBubbleForeground": "#ffffff"
    },
    "position": "bottom-right",
    "welcomeMessage": "Hi! Ask me anything about our docs.",
    "inputPlaceholder": "Ask a question..."
  },
  "ai": {
    "baseUrl": "http://localhost:11434/v1",
    "apiKey": "ollama",
    "model": "llama3",
    "temperature": 0.7,
    "maxTokens": 1024,
    "systemPromptPrefix": "You specialize in developer documentation. Always include code examples when relevant."
  },
  "guardrails": {
    "allowedTopics": ["documentation", "api", "setup", "troubleshooting"],
    "topicDescription": "Questions about our product documentation and API",
    "refusalMessage": "I can only help with documentation-related questions. Is there something else I can assist you with?",
    "blockedInputPatterns": [],
    "blockedOutputPatterns": [],
    "maxInputLength": 2000,
    "enablePromptInjectionDetection": true,
    "enableOutputScrubbing": true
  },
  "knowledge": {
    "sources": [
      {
        "type": "text",
        "title": "About Us",
        "content": "We build developer tools used by over 10,000 teams worldwide."
      },
      {
        "type": "faq",
        "entries": [
          {
            "question": "What are your support hours?",
            "answer": "Monday to Friday, 9am-5pm EST."
          }
        ]
      },
      {
        "type": "url",
        "url": "https://example.com/docs.md",
        "title": "Documentation",
        "refreshIntervalHours": 24
      },
      {
        "type": "file",
        "filePath": "product-guide.md",
        "title": "Product Guide"
      }
    ],
    "maxContextTokens": 4000
  },
  "tickets": {
    "enabled": true,
    "promptMessage": "Would you like me to create a support ticket for this issue?",
    "providers": [
      {
        "provider": "github",
        "owner": "your-org",
        "repo": "support",
        "token": "ghp_...",
        "labels": ["kody-ticket"]
      }
    ],
    "requiredFields": ["email", "description"]
  },
  "rateLimit": {
    "messagesPerMinute": 10,
    "messagesPerHour": 100,
    "messagesPerDay": 1000
  }
}`}</code>
        </pre>
      </section>
    </article>
  );
}
