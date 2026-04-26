import { describe, it, expect } from "vitest";
import { chatRequestSchema, chatResponseEventSchema } from "../src/validators/chat.js";

describe("chatRequestSchema", () => {
  it("accepts a valid request with sessionId", () => {
    const result = chatRequestSchema.parse({
      siteId: "my-site",
      sessionId: "sess-123",
      message: "Hello!",
    });
    expect(result.siteId).toBe("my-site");
    expect(result.sessionId).toBe("sess-123");
    expect(result.message).toBe("Hello!");
  });

  it("accepts a request without sessionId", () => {
    const result = chatRequestSchema.parse({
      siteId: "my-site",
      message: "Hello!",
    });
    expect(result.sessionId).toBeUndefined();
  });

  it("rejects empty siteId", () => {
    expect(() => chatRequestSchema.parse({ siteId: "", message: "Hello!" })).toThrow();
  });

  it("rejects empty message", () => {
    expect(() => chatRequestSchema.parse({ siteId: "my-site", message: "" })).toThrow();
  });

  it("rejects missing message", () => {
    expect(() => chatRequestSchema.parse({ siteId: "my-site" })).toThrow();
  });
});

describe("chatResponseEventSchema", () => {
  it("accepts session event", () => {
    const result = chatResponseEventSchema.parse({
      type: "session",
      sessionId: "sess-abc",
    });
    expect(result.type).toBe("session");
  });

  it("accepts delta event", () => {
    const result = chatResponseEventSchema.parse({
      type: "delta",
      content: "Hello",
    });
    expect(result.type).toBe("delta");
  });

  it("accepts done event", () => {
    const result = chatResponseEventSchema.parse({ type: "done" });
    expect(result.type).toBe("done");
  });

  it("accepts error event", () => {
    const result = chatResponseEventSchema.parse({
      type: "error",
      message: "Something went wrong",
    });
    expect(result.type).toBe("error");
  });

  it("accepts blocked event", () => {
    const result = chatResponseEventSchema.parse({
      type: "blocked",
      message: "This question is off-topic",
    });
    expect(result.type).toBe("blocked");
  });

  it("accepts ticket_prompt event", () => {
    const result = chatResponseEventSchema.parse({
      type: "ticket_prompt",
      message: "Would you like to create a ticket?",
    });
    expect(result.type).toBe("ticket_prompt");
  });

  it("rejects unknown event type", () => {
    expect(() => chatResponseEventSchema.parse({ type: "unknown" })).toThrow();
  });
});
