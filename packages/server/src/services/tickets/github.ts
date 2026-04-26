import type { TicketData, TicketProvider, TicketResult } from "./types.js";

export interface GitHubConfig {
  provider: "github";
  owner: string;
  repo: string;
  token: string;
  labels: string[];
}

function buildTitle(fields: TicketData["fields"]): string {
  const suffix = fields.subject || `Support ticket from ${fields.name || fields.email || "user"}`;
  return `[Kody] ${suffix}`;
}

function buildBody(data: TicketData): string {
  const lines: string[] = [];

  if (data.fields.name) lines.push(`**Name:** ${data.fields.name}`);
  if (data.fields.email) lines.push(`**Email:** ${data.fields.email}`);
  lines.push("", `**Description:**`, data.fields.description);

  if (data.transcript) {
    lines.push("", "---", "", "**Transcript:**", "", data.transcript);
  }

  return lines.join("\n");
}

export class GitHubProvider implements TicketProvider {
  constructor(private config: GitHubConfig) {}

  async createTicket(data: TicketData): Promise<TicketResult> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/issues`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        title: buildTitle(data.fields),
        body: buildBody(data),
        labels: this.config.labels,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        message: `GitHub API error: ${response.status} ${text}`,
      };
    }

    const result = (await response.json()) as { number: number; html_url: string };

    return {
      success: true,
      ticketId: String(result.number),
      ticketUrl: result.html_url,
      message: "GitHub issue created",
    };
  }
}
