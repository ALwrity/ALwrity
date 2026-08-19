import { buildPlanPromptPreview, EXA_RESEARCH_PLACEHOLDER } from "./buildPlanPromptPreview";

describe("buildPlanPromptPreview", () => {
  it("includes idea and Exa placeholder when research is on", () => {
    const preview = buildPlanPromptPreview({
      userIdea: "Budget Japan travel",
      durationType: "shorts",
      videoType: "tutorial",
      targetAudience: "First timers",
      videoGoal: "Educate",
      brandStyle: "Clean",
      enableResearch: true,
      channelBible: null,
    });

    expect(preview.systemPrompt).toContain("YouTube content strategist");
    expect(preview.userPromptTemplate).toContain("Budget Japan travel");
    expect(preview.userPromptTemplate).toContain(EXA_RESEARCH_PLACEHOLDER);
    expect(preview.userPromptTemplate).toContain("tutorial");
  });

  it("omits Exa placeholder when research is off", () => {
    const preview = buildPlanPromptPreview({
      userIdea: "Budget Japan travel",
      durationType: "medium",
      enableResearch: false,
    });

    expect(preview.userPromptTemplate).not.toContain(EXA_RESEARCH_PLACEHOLDER);
    expect(preview.userPromptTemplate).toContain("Web research is off");
  });
});
