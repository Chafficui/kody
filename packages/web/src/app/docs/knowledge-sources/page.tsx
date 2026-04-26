export default function KnowledgeSourcesPage() {
  return (
    <article>
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Knowledge Sources</h1>
      <p className="mb-10 text-lg text-muted-foreground">
        Give your assistant context about your product, service, or organization. Kody supports four
        types of knowledge sources.
      </p>

      <p className="mb-4 text-foreground">
        Knowledge sources are added to the{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">knowledge.sources</code> array in
        your site configuration. The content is formatted with numbered references ([1], [2], etc.)
        and injected into the system prompt under a &quot;REFERENCE INFORMATION&quot; section so the
        AI can cite sources when answering questions.
      </p>
      <p className="mb-8 text-foreground">
        All knowledge content is processed and stored server-side only &mdash; it is never sent to
        the browser. The AI sees it in its system prompt context.
      </p>

      {/* Text */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Text</h2>
        <p className="mb-4 text-foreground">
          Inline text content with a title. Best for small, static pieces of information like
          company descriptions, policies, product summaries, or any content you want to control
          directly in the config.
        </p>
        <div className="overflow-x-auto">
          <table className="mb-4 w-full text-left text-sm">
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
                <td className="py-2 pr-4 font-mono text-xs">type</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;text&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">title</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Title for this knowledge source. Used as the reference label. 1-200 chars.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">content</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  The text content itself. 1-50,000 chars. Markdown is supported.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "type": "text",
  "title": "About Our Company",
  "content": "Acme Corp is a B2B SaaS company that builds developer tools. Founded in 2020, we serve over 10,000 teams worldwide. Our main products include AcmeCI (continuous integration), AcmeDeploy (deployment automation), and AcmeMonitor (observability platform)."
}`}</code>
        </pre>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> Keep text sources concise and factual.
          Remove marketing fluff and boilerplate &mdash; focus on information the AI actually needs
          to answer questions accurately.
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">FAQ</h2>
        <p className="mb-4 text-foreground">
          A list of question/answer pairs. The AI can match user queries against these and provide
          accurate, pre-approved answers. FAQs are the most token-efficient knowledge format &mdash;
          each Q/A pair is compact and highly specific.
        </p>
        <div className="overflow-x-auto">
          <table className="mb-4 w-full text-left text-sm">
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
                <td className="py-2 pr-4 font-mono text-xs">type</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;faq&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">entries</td>
                <td className="py-2 pr-4">array</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Array of objects, each with a <code className="text-xs">question</code> (1-500
                  chars) and <code className="text-xs">answer</code> (1-5,000 chars). At least one
                  entry required.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "type": "faq",
  "entries": [
    {
      "question": "What are your support hours?",
      "answer": "Our support team is available Monday to Friday, 9am-5pm EST. For critical issues, we offer 24/7 on-call support for Enterprise customers."
    },
    {
      "question": "Do you offer a free trial?",
      "answer": "Yes! All plans come with a 14-day free trial. No credit card required. You can upgrade or cancel at any time."
    },
    {
      "question": "How do I reset my password?",
      "answer": "Go to the login page and click 'Forgot password'. Enter your email address and we'll send you a reset link that expires in 1 hour."
    }
  ]
}`}</code>
        </pre>
      </section>

      {/* URL */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">URL</h2>
        <p className="mb-4 text-foreground">
          Content fetched from a URL and cached server-side. The server periodically re-fetches the
          content based on the configured refresh interval, so your assistant stays up to date
          without manual intervention. This is ideal for documentation pages, changelogs, or any
          content that lives at a URL.
        </p>
        <div className="overflow-x-auto">
          <table className="mb-4 w-full text-left text-sm">
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
                <td className="py-2 pr-4 font-mono text-xs">type</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;url&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">url</td>
                <td className="py-2 pr-4">string (URL)</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  URL to fetch content from. Must be a valid, accessible URL.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">title</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Optional title for this source (up to 200 chars). Defaults to the URL if not set.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">refreshIntervalHours</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">24</td>
                <td className="py-2">
                  How often to re-fetch the content, in hours. Range: 1-720 (30 days). Lower values
                  keep content fresher but increase network requests.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "type": "url",
  "url": "https://example.com/docs/faq.md",
  "title": "FAQ Page",
  "refreshIntervalHours": 12
}`}</code>
        </pre>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Best practices for URL sources:</strong>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              Use plain text or Markdown URLs when possible &mdash; HTML pages include a lot of
              boilerplate that wastes tokens
            </li>
            <li>Point to raw content URLs (e.g. GitHub raw URLs) rather than rendered pages</li>
            <li>
              Set the refresh interval based on how often the content changes &mdash; 24 hours is
              fine for most documentation
            </li>
          </ul>
        </div>
      </section>

      {/* File */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">File</h2>
        <p className="mb-4 text-foreground">
          Local files read from the server&apos;s{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">knowledge-files</code> directory.
          Useful for documents you want to manage alongside your deployment &mdash; product guides,
          internal policies, or pre-compiled knowledge bases.
        </p>
        <div className="overflow-x-auto">
          <table className="mb-4 w-full text-left text-sm">
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
                <td className="py-2 pr-4 font-mono text-xs">type</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;file&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">filePath</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Path relative to the <code className="text-xs">knowledge-files</code> directory.
                  Min 1 char.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">title</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Optional title (up to 200 chars). Defaults to the file path if not set.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "type": "file",
  "filePath": "product-guide.md",
  "title": "Product Guide"
}`}</code>
        </pre>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Security:</strong> File paths are restricted to the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">knowledge-files</code> directory.
          Path traversal attempts (e.g. <code className="text-xs">../../etc/passwd</code>) are
          rejected by the server. Files are read server-side only and never exposed to the client.
        </div>
      </section>

      {/* Token Budget */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Token Budget</h2>
        <p className="mb-4 text-foreground">
          The{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">knowledge.maxContextTokens</code>{" "}
          field controls how much knowledge content is included in each request to the AI provider.
          The default is <strong>4,000 tokens</strong> (range: 100-32,000).
        </p>
        <p className="mb-4 text-foreground">
          When total knowledge content exceeds the token budget, sources are included in the order
          they appear in the configuration array, and content is truncated once the budget is
          reached. Sources that do not fit within the budget are excluded entirely from that
          request.
        </p>
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Tips for managing the token budget:</strong>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Put the most important sources first</strong> in the array &mdash; they are
              guaranteed to be included
            </li>
            <li>
              <strong>Use FAQ entries</strong> for common questions &mdash; they are the most
              token-efficient format (compact Q/A pairs)
            </li>
            <li>
              <strong>Keep text sources concise</strong> &mdash; remove boilerplate and focus on
              information the AI needs to answer questions
            </li>
            <li>
              <strong>Prefer Markdown or plain text</strong> URLs over HTML pages &mdash; HTML
              includes lots of boilerplate that wastes tokens
            </li>
            <li>
              <strong>Increase the budget</strong> (up to 32,000) if you have many sources, but be
              aware this increases AI costs and response latency
            </li>
          </ul>
        </div>
      </section>

      {/* Complete example */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Complete Example</h2>
        <p className="mb-4 text-foreground">
          A knowledge configuration using all four source types:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "knowledge": {
    "sources": [
      {
        "type": "text",
        "title": "Company Overview",
        "content": "Acme Corp builds developer tools. Founded 2020. 10,000+ teams. Products: AcmeCI, AcmeDeploy, AcmeMonitor."
      },
      {
        "type": "faq",
        "entries": [
          {
            "question": "What plans do you offer?",
            "answer": "We offer Starter ($29/mo), Pro ($99/mo), and Enterprise (custom pricing). All plans include a 14-day free trial."
          },
          {
            "question": "How do I contact support?",
            "answer": "Email support@acme.com or use the chat widget. Enterprise customers have access to a dedicated Slack channel."
          }
        ]
      },
      {
        "type": "url",
        "url": "https://raw.githubusercontent.com/acme/docs/main/changelog.md",
        "title": "Changelog",
        "refreshIntervalHours": 6
      },
      {
        "type": "file",
        "filePath": "api-reference.md",
        "title": "API Reference"
      }
    ],
    "maxContextTokens": 6000
  }
}`}</code>
        </pre>
      </section>
    </article>
  );
}
