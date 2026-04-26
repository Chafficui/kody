import type { TicketData, TicketProvider, TicketResult } from "./types.js";

export interface JiraConfig {
  provider: "jira";
  baseUrl: string;
  projectKey: string;
  apiToken: string;
  email: string;
  issueType: string;
}

function buildDescription(data: TicketData): string {
  const lines: string[] = [];

  if (data.fields.name) lines.push(`Name: ${data.fields.name}`);
  if (data.fields.email) lines.push(`Email: ${data.fields.email}`);
  lines.push("", data.fields.description);

  if (data.transcript) {
    lines.push("", "---", "", "Transcript:", "", data.transcript);
  }

  return lines.join("\n");
}

export class JiraProvider implements TicketProvider {
  constructor(private config: JiraConfig) {}

  async createTicket(data: TicketData): Promise<TicketResult> {
    const url = `${this.config.baseUrl}/rest/api/2/issue`;
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString("base64");

    const summary =
      data.fields.subject ||
      `Support ticket from ${data.fields.name || data.fields.email || "user"}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        fields: {
          project: { key: this.config.projectKey },
          summary,
          description: buildDescription(data),
          issuetype: { name: this.config.issueType },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        message: `Jira API error: ${response.status} ${text}`,
      };
    }

    const result = (await response.json()) as { key: string; self: string };

    return {
      success: true,
      ticketId: result.key,
      ticketUrl: `${this.config.baseUrl}/browse/${result.key}`,
      message: "Jira issue created",
    };
  }
}
