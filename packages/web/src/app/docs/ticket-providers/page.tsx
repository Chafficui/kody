export default function TicketProvidersPage() {
  return (
    <article>
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Ticket Providers</h1>
      <p className="mb-10 text-lg text-muted-foreground">
        Let users create support tickets directly from the chat widget. Kody supports five ticket
        providers out of the box.
      </p>

      <p className="mb-4 text-foreground">
        Enable tickets in your site config by setting{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">tickets.enabled</code> to{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">true</code> and adding at least one
        provider to the{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">tickets.providers</code> array.
        When multiple providers are configured, tickets are sent to <strong>all of them</strong>{" "}
        simultaneously.
      </p>
      <p className="mb-8 text-foreground">
        You can configure which fields are required from the user via{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">tickets.requiredFields</code>.
        Valid values are: <code className="text-xs">&quot;name&quot;</code>,{" "}
        <code className="text-xs">&quot;email&quot;</code>,{" "}
        <code className="text-xs">&quot;subject&quot;</code>, and{" "}
        <code className="text-xs">&quot;description&quot;</code>. Defaults to{" "}
        <code className="text-xs">[&quot;email&quot;, &quot;description&quot;]</code>.
      </p>

      {/* Jira */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Jira</h2>
        <p className="mb-4 text-foreground">
          Creates issues in your Jira Cloud instance. Uses the Jira REST API v3 with email + API
          token authentication.
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
                <td className="py-2 pr-4 font-mono text-xs">provider</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;jira&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">baseUrl</td>
                <td className="py-2 pr-4">string (URL)</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Your Jira instance URL (e.g.{" "}
                  <code className="text-xs">https://yourorg.atlassian.net</code>).
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">projectKey</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Jira project key (e.g. SUP, HELP, SUPPORT). Min 1 char.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">apiToken</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Jira API token for authentication. Min 1 char.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">email</td>
                <td className="py-2 pr-4">string (email)</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Atlassian account email associated with the API token.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">issueType</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&quot;Task&quot;</td>
                <td className="py-2">
                  Issue type to create (e.g. &quot;Task&quot;, &quot;Bug&quot;, &quot;Story&quot;).
                  Must match an issue type in your project.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mb-2 text-sm font-medium text-foreground">Getting an API token:</p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>
            Go to{" "}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Atlassian API Tokens
            </a>
          </li>
          <li>Click &quot;Create API token&quot; and give it a descriptive label</li>
          <li>
            Copy the token and use it as the <code className="text-xs">apiToken</code> value
          </li>
          <li>
            Use the email address of your Atlassian account as the{" "}
            <code className="text-xs">email</code> value
          </li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "provider": "jira",
  "baseUrl": "https://yourorg.atlassian.net",
  "projectKey": "SUP",
  "apiToken": "your-api-token",
  "email": "you@example.com",
  "issueType": "Task"
}`}</code>
        </pre>
      </section>

      {/* GitHub */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">GitHub Issues</h2>
        <p className="mb-4 text-foreground">
          Creates issues in a GitHub repository. Uses the GitHub REST API with a personal access
          token. You can auto-apply labels to organize tickets.
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
                <td className="py-2 pr-4 font-mono text-xs">provider</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;github&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">owner</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">GitHub organization or user that owns the repository.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">repo</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Repository name where issues will be created.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">token</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Personal access token with Issues write permission.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">labels</td>
                <td className="py-2 pr-4">string[]</td>
                <td className="py-2 pr-4">[&quot;kody-ticket&quot;]</td>
                <td className="py-2">
                  Labels to apply to created issues. The labels must exist in the repository.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mb-2 text-sm font-medium text-foreground">
          Creating a personal access token:
        </p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>
            Go to{" "}
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              GitHub Fine-grained tokens
            </a>
          </li>
          <li>Click &quot;Generate new token&quot;</li>
          <li>
            Select the target repository and grant <strong>Issues: Read and write</strong>{" "}
            permission
          </li>
          <li>
            Copy the token and use it as the <code className="text-xs">token</code> value
          </li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "provider": "github",
  "owner": "your-org",
  "repo": "support",
  "token": "ghp_xxxxxxxxxxxx",
  "labels": ["kody-ticket", "bug"]
}`}</code>
        </pre>
      </section>

      {/* Linear */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Linear</h2>
        <p className="mb-4 text-foreground">
          Creates issues in a Linear team using the Linear GraphQL API. Issues are assigned to the
          specified team and can have labels applied automatically.
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
                <td className="py-2 pr-4 font-mono text-xs">provider</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;linear&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">apiKey</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Linear API key. Min 1 char.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">teamId</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">
                  Team ID to create issues in. You can find this in your team settings or via the
                  Linear API.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">labelIds</td>
                <td className="py-2 pr-4">string[]</td>
                <td className="py-2 pr-4">[]</td>
                <td className="py-2">Label IDs to apply to created issues.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mb-2 text-sm font-medium text-foreground">Getting an API key:</p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>
            Go to{" "}
            <a
              href="https://linear.app/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Linear Settings &rarr; API
            </a>
          </li>
          <li>Create a new personal API key</li>
          <li>
            Copy the key and use it as the <code className="text-xs">apiKey</code> value
          </li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "provider": "linear",
  "apiKey": "lin_api_xxxxxxxxxxxx",
  "teamId": "TEAM-ID",
  "labelIds": ["label-id-1"]
}`}</code>
        </pre>
      </section>

      {/* Email */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Email</h2>
        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Note:</strong> The email provider is currently a stub
          implementation. SMTP delivery is not yet functional, but the configuration schema is
          stable and will be preserved when the implementation ships.
        </div>
        <p className="mb-4 text-foreground">
          Sends ticket notifications via email using SMTP. The recipient address is required; all
          SMTP fields are optional to support future hosted email relay.
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
                <td className="py-2 pr-4 font-mono text-xs">provider</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;email&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">to</td>
                <td className="py-2 pr-4">string (email)</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Recipient email address. Must be a valid email.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">from</td>
                <td className="py-2 pr-4">string (email)</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">Sender email address. Must be a valid email. Optional.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">smtpHost</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">SMTP server hostname (e.g. smtp.gmail.com). Optional.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">smtpPort</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  SMTP server port (e.g. 587 for TLS, 465 for SSL). Optional.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">smtpUser</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">SMTP username for authentication. Optional.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">smtpPass</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  SMTP password for authentication. Stored server-side only. Optional.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "provider": "email",
  "to": "support@example.com",
  "from": "noreply@example.com",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpUser": "smtp-user",
  "smtpPass": "smtp-password"
}`}</code>
        </pre>
      </section>

      {/* Webhook */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Webhook</h2>
        <p className="mb-4 text-foreground">
          Sends ticket data to any HTTP endpoint. This is the most flexible option &mdash; use it to
          integrate with Slack, Discord, Notion, your own API, or any service that accepts webhooks.
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
                <td className="py-2 pr-4 font-mono text-xs">provider</td>
                <td className="py-2 pr-4">literal</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  Must be <code className="text-xs">&quot;webhook&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">url</td>
                <td className="py-2 pr-4">string (URL)</td>
                <td className="py-2 pr-4 text-red-500">required</td>
                <td className="py-2">Webhook endpoint URL. Must be a valid URL.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">method</td>
                <td className="py-2 pr-4">enum</td>
                <td className="py-2 pr-4">&quot;POST&quot;</td>
                <td className="py-2">
                  HTTP method: <code className="text-xs">&quot;POST&quot;</code> or{" "}
                  <code className="text-xs">&quot;PUT&quot;</code>.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">headers</td>
                <td className="py-2 pr-4">Record&lt;string, string&gt;</td>
                <td className="py-2 pr-4">{"{}"}</td>
                <td className="py-2">
                  Custom headers to include in the request. Useful for authentication tokens or
                  content type overrides.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">secret</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">&mdash;</td>
                <td className="py-2">
                  HMAC-SHA256 secret for signature verification. When set, Kody includes an{" "}
                  <code className="text-xs">X-Kody-Signature</code> header. Optional.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mb-3 text-lg font-semibold">Signature Verification</h3>
        <p className="mb-4 text-foreground">
          When a <code className="rounded bg-muted px-1.5 py-0.5 text-sm">secret</code> is
          configured, Kody includes an{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">X-Kody-Signature</code> header
          containing an HMAC-SHA256 hex digest of the request body. Verify this on your server to
          ensure requests are authentic and have not been tampered with.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "provider": "webhook",
  "url": "https://example.com/api/tickets",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer your-token"
  },
  "secret": "your-hmac-secret"
}`}</code>
        </pre>

        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Verifying the signature (Node.js):</strong>
          <pre className="mt-2 overflow-x-auto rounded bg-[#1e293b] p-3 text-xs leading-relaxed text-[#e2e8f0]">
            <code>{`import crypto from "node:crypto";

function verify(body: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}`}</code>
          </pre>
        </div>
      </section>

      {/* Multiple providers */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Using Multiple Providers</h2>
        <p className="mb-4 text-foreground">
          You can configure multiple providers simultaneously. Tickets are sent to all of them when
          a user submits one. This is useful for keeping multiple systems in sync, e.g. creating a
          GitHub issue and sending a Slack notification via webhook at the same time:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm leading-relaxed text-[#e2e8f0]">
          <code>{`{
  "tickets": {
    "enabled": true,
    "promptMessage": "Would you like me to create a support ticket?",
    "providers": [
      {
        "provider": "github",
        "owner": "your-org",
        "repo": "support",
        "token": "ghp_...",
        "labels": ["kody-ticket"]
      },
      {
        "provider": "webhook",
        "url": "https://hooks.slack.com/services/T.../B.../xxx",
        "method": "POST"
      }
    ],
    "requiredFields": ["name", "email", "description"]
  }
}`}</code>
        </pre>
      </section>
    </article>
  );
}
