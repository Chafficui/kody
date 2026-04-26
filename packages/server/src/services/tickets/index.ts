import type { TicketProvider } from "./types.js";
import { WebhookProvider, type WebhookConfig } from "./webhook.js";
import { GitHubProvider, type GitHubConfig } from "./github.js";
import { JiraProvider, type JiraConfig } from "./jira.js";
import { LinearProvider, type LinearConfig } from "./linear.js";
import { EmailProvider, type EmailConfig } from "./email.js";

export type TicketProviderConfig =
  | WebhookConfig
  | GitHubConfig
  | JiraConfig
  | LinearConfig
  | EmailConfig;

export function createTicketProvider(config: TicketProviderConfig): TicketProvider {
  switch (config.provider) {
    case "webhook":
      return new WebhookProvider(config);
    case "github":
      return new GitHubProvider(config);
    case "jira":
      return new JiraProvider(config);
    case "linear":
      return new LinearProvider(config);
    case "email":
      return new EmailProvider(config);
  }
}

export type { TicketData, TicketResult, TicketProvider } from "./types.js";
