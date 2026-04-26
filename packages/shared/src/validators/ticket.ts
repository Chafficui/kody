import { z } from "zod";

export const ticketRequestSchema = z.object({
  siteId: z.string().min(1),
  sessionId: z.string().min(1),
  fields: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    subject: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000),
  }),
  includeTranscript: z.boolean().default(true),
});

export const ticketResultSchema = z.object({
  success: z.boolean(),
  ticketId: z.string().optional(),
  ticketUrl: z.string().url().optional(),
  message: z.string(),
});

export type TicketRequest = z.infer<typeof ticketRequestSchema>;
export type TicketResult = z.infer<typeof ticketResultSchema>;
