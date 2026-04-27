import type { SiteConfig } from "@kody/shared";
import type { ToolDefinition } from "../ai-provider.js";
import type { KnowledgeRetriever } from "../knowledge/retriever.js";
import { createTicketProvider, type TicketProviderConfig } from "../tickets/index.js";

export function getBuiltinToolDefinitions(config: SiteConfig): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  if (config.tools.builtinTools.knowledgeSearch) {
    tools.push({
      type: "function",
      function: {
        name: "knowledge_search",
        description:
          "Search the knowledge base for information relevant to the user's question. Use this when you need to find specific information to answer accurately.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant information",
            },
          },
          required: ["query"],
        },
      },
    });
  }

  if (config.tickets.enabled && config.tickets.providers.length > 0) {
    const requiredFields = config.tickets.requiredFields;
    const properties: Record<string, unknown> = {
      description: {
        type: "string",
        description: "Detailed description of the issue or request",
      },
    };

    if (requiredFields.includes("name")) {
      properties.name = { type: "string", description: "User's name" };
    }
    if (requiredFields.includes("email")) {
      properties.email = { type: "string", description: "User's email address" };
    }
    if (requiredFields.includes("subject")) {
      properties.subject = { type: "string", description: "Brief subject line for the ticket" };
    }

    tools.push({
      type: "function",
      function: {
        name: "create_ticket",
        description:
          "Create a support ticket for the user. Collect all required information from the user before calling this tool.",
        parameters: {
          type: "object",
          properties,
          required: requiredFields as unknown as string[],
        },
      },
    });
  }

  return tools;
}

export async function executeBuiltinTool(
  name: string,
  args: Record<string, unknown>,
  config: SiteConfig,
  retriever: KnowledgeRetriever | null,
): Promise<{ result: string; displayText: string }> {
  switch (name) {
    case "knowledge_search": {
      if (!retriever || !retriever.hasIndex(config.siteId)) {
        return {
          result: "Knowledge search is not available — no indexed content found.",
          displayText: "Searching knowledge base...",
        };
      }
      const query = String(args.query ?? "");
      const rag = config.knowledge.rag;
      const results = await retriever.retrieve(config.siteId, query, {
        topK: rag.topK,
        similarityThreshold: rag.similarityThreshold,
      });
      const context = retriever.formatAsContext(results);
      return {
        result: context || "No relevant information found.",
        displayText: "Searching knowledge base...",
      };
    }

    case "create_ticket": {
      if (!config.tickets.enabled || config.tickets.providers.length === 0) {
        return {
          result: "Ticket creation is not configured.",
          displayText: "Creating support ticket...",
        };
      }

      const provider = createTicketProvider(
        config.tickets.providers[0] as TicketProviderConfig,
      );
      const ticketResult = await provider.createTicket({
        fields: {
          name: args.name as string | undefined,
          email: args.email as string | undefined,
          subject: args.subject as string | undefined,
          description: String(args.description ?? ""),
        },
        siteId: config.siteId,
      });

      if (ticketResult.success) {
        const url = ticketResult.ticketUrl ? ` URL: ${ticketResult.ticketUrl}` : "";
        return {
          result: `Ticket created successfully. ID: ${ticketResult.ticketId ?? "N/A"}.${url}`,
          displayText: "Creating support ticket...",
        };
      }
      return {
        result: `Failed to create ticket: ${ticketResult.message}`,
        displayText: "Creating support ticket...",
      };
    }

    default:
      return { result: `Unknown built-in tool: ${name}`, displayText: `Running ${name}...` };
  }
}
