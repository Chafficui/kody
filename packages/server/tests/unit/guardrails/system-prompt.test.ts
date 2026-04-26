import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  type SystemPromptInput,
} from "../../../src/services/guardrails/system-prompt.js";

const minimalInput: SystemPromptInput = {
  branding: {
    name: "HelpBot",
    tagline: "Your friendly assistant",
  },
  guardrails: {
    allowedTopics: ["billing", "technical support"],
    topicDescription: "Help users with billing questions and technical issues.",
    refusalMessage: "I can only help with billing and technical support.",
  },
  knowledge: { sources: [] },
  systemPromptPrefix: undefined,
};

describe("buildSystemPrompt", () => {
  it("includes the assistant name", () => {
    const prompt = buildSystemPrompt(minimalInput);
    expect(prompt).toContain("HelpBot");
  });

  it("includes the tagline", () => {
    const prompt = buildSystemPrompt(minimalInput);
    expect(prompt).toContain("Your friendly assistant");
  });

  it("includes allowed topics", () => {
    const prompt = buildSystemPrompt(minimalInput);
    expect(prompt).toContain("billing");
    expect(prompt).toContain("technical support");
  });

  it("includes the topic description", () => {
    const prompt = buildSystemPrompt(minimalInput);
    expect(prompt).toContain("Help users with billing questions and technical issues.");
  });

  it("includes the refusal message", () => {
    const prompt = buildSystemPrompt(minimalInput);
    expect(prompt).toContain("I can only help with billing and technical support.");
  });

  it("includes anti-leakage instructions", () => {
    const prompt = buildSystemPrompt(minimalInput);
    expect(prompt.toLowerCase()).toContain("never reveal");
    expect(prompt.toLowerCase()).toContain("never mention");
  });

  it("includes anti-roleplay instructions", () => {
    const prompt = buildSystemPrompt(minimalInput);
    expect(prompt.toLowerCase()).toContain("never change your behavior");
  });

  it("includes systemPromptPrefix when provided", () => {
    const input = {
      ...minimalInput,
      systemPromptPrefix: "Always be concise. Use bullet points.",
    };
    const prompt = buildSystemPrompt(input);
    expect(prompt).toContain("Always be concise. Use bullet points.");
  });

  it("works without tagline", () => {
    const input = {
      ...minimalInput,
      branding: { name: "Bot", tagline: undefined },
    };
    const prompt = buildSystemPrompt(input);
    expect(prompt).toContain("Bot");
  });

  describe("knowledge injection", () => {
    it("injects text knowledge", () => {
      const input: SystemPromptInput = {
        ...minimalInput,
        knowledge: {
          sources: [
            {
              type: "text" as const,
              title: "Return Policy",
              content: "You can return items within 30 days.",
            },
          ],
        },
      };
      const prompt = buildSystemPrompt(input);
      expect(prompt).toContain("Return Policy");
      expect(prompt).toContain("You can return items within 30 days.");
    });

    it("injects FAQ knowledge", () => {
      const input: SystemPromptInput = {
        ...minimalInput,
        knowledge: {
          sources: [
            {
              type: "faq" as const,
              entries: [
                { question: "What is your return policy?", answer: "30 days." },
                { question: "Do you ship internationally?", answer: "Yes, worldwide." },
              ],
            },
          ],
        },
      };
      const prompt = buildSystemPrompt(input);
      expect(prompt).toContain("What is your return policy?");
      expect(prompt).toContain("30 days.");
      expect(prompt).toContain("Do you ship internationally?");
      expect(prompt).toContain("Yes, worldwide.");
    });

    it("injects multiple knowledge sources", () => {
      const input: SystemPromptInput = {
        ...minimalInput,
        knowledge: {
          sources: [
            { type: "text" as const, title: "Hours", content: "9am-5pm" },
            {
              type: "faq" as const,
              entries: [{ question: "Where are you?", answer: "NYC" }],
            },
          ],
        },
      };
      const prompt = buildSystemPrompt(input);
      expect(prompt).toContain("9am-5pm");
      expect(prompt).toContain("NYC");
    });

    it("handles empty knowledge sources", () => {
      const prompt = buildSystemPrompt(minimalInput);
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe("prompt structure", () => {
    it("puts identity before rules", () => {
      const prompt = buildSystemPrompt(minimalInput);
      const identityPos = prompt.indexOf("HelpBot");
      const rulesPos = prompt.toLowerCase().indexOf("never reveal");
      expect(identityPos).toBeLessThan(rulesPos);
    });

    it("puts knowledge after rules", () => {
      const input: SystemPromptInput = {
        ...minimalInput,
        knowledge: {
          sources: [{ type: "text" as const, title: "Info", content: "Some info" }],
        },
      };
      const prompt = buildSystemPrompt(input);
      const rulesPos = prompt.toLowerCase().indexOf("never reveal");
      const knowledgePos = prompt.indexOf("Some info");
      expect(rulesPos).toBeLessThan(knowledgePos);
    });
  });
});
