import { planGenerationProgressPercent } from "./youtubePlanGenerationLoader";
import { getYouTubePlanIdeaEnhanceLoaderCopy } from "./youtubePlanIdeaEnhanceLoader";

describe("youtubePlanIdeaEnhanceLoader", () => {
  it("lists Channel Bible, prompt, LLM, and three-choice validation steps", () => {
    const { messages, steps } = getYouTubePlanIdeaEnhanceLoaderCopy();
    expect(messages[0]).toMatch(/Channel Bible/i);
    expect(messages.some((item) => /llm_text_gen/i.test(item))).toBe(true);
    expect(steps).toContain("Validate three topic choices");
    expect(steps).toHaveLength(4);
  });

  it("uses the same four-step progress scale as Generate Pitch", () => {
    const { messages } = getYouTubePlanIdeaEnhanceLoaderCopy();
    expect(planGenerationProgressPercent(0, messages.length)).toBe(25);
    expect(planGenerationProgressPercent(messages.length - 1, messages.length)).toBe(95);
  });
});
