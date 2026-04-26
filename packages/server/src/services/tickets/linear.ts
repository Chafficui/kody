import type { TicketData, TicketProvider, TicketResult } from "./types.js";

export interface LinearConfig {
  provider: "linear";
  apiKey: string;
  teamId: string;
  labelIds: string[];
}

function buildDescription(data: TicketData): string {
  const lines: string[] = [];

  if (data.fields.name) lines.push(`**Name:** ${data.fields.name}`);
  if (data.fields.email) lines.push(`**Email:** ${data.fields.email}`);
  lines.push("", data.fields.description);

  if (data.transcript) {
    lines.push("", "---", "", "**Transcript:**", "", data.transcript);
  }

  return lines.join("\n");
}

const ISSUE_CREATE_MUTATION = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        url
      }
    }
  }
`;

export class LinearProvider implements TicketProvider {
  constructor(private config: LinearConfig) {}

  async createTicket(data: TicketData): Promise<TicketResult> {
    const title =
      data.fields.subject ||
      `Support ticket from ${data.fields.name || data.fields.email || "user"}`;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.config.apiKey,
      },
      body: JSON.stringify({
        query: ISSUE_CREATE_MUTATION,
        variables: {
          input: {
            teamId: this.config.teamId,
            title,
            description: buildDescription(data),
            labelIds: this.config.labelIds,
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        message: `Linear API error: ${response.status} ${text}`,
      };
    }

    const result = (await response.json()) as {
      data?: {
        issueCreate: {
          success: boolean;
          issue: { id: string; identifier: string; url: string };
        };
      };
      errors?: { message: string }[];
    };

    if (result.errors?.length) {
      return {
        success: false,
        message: `Linear GraphQL error: ${result.errors[0].message}`,
      };
    }

    const issue = result.data!.issueCreate.issue;

    return {
      success: true,
      ticketId: issue.identifier,
      ticketUrl: issue.url,
      message: "Linear issue created",
    };
  }
}
