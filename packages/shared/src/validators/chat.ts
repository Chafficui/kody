import { z } from "zod";

export const chatRoleSchema = z.enum(["user", "assistant", "system", "tool"]);

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string(),
  tool_call_id: z.string().optional(),
});

export const chatRequestSchema = z.object({
  siteId: z.string().min(1),
  sessionId: z.string().optional(),
  message: z.string().min(1),
});

export const chatResponseEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session"),
    sessionId: z.string(),
  }),
  z.object({
    type: z.literal("delta"),
    content: z.string(),
  }),
  z.object({
    type: z.literal("done"),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("blocked"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("ticket_prompt"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("tool_start"),
    name: z.string(),
    displayText: z.string(),
  }),
  z.object({
    type: z.literal("tool_end"),
    name: z.string(),
  }),
  z.object({
    type: z.literal("sources"),
    chunks: z.array(
      z.object({
        title: z.string(),
        url: z.string().optional(),
        score: z.number(),
      }),
    ),
  }),
]);

export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponseEvent = z.infer<typeof chatResponseEventSchema>;
