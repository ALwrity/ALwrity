import { getPlanGenerationLoaderCopy, planGenerationProgressPercent } from "./youtubePlanGenerationLoader";

describe("youtubePlanGenerationLoader", () => {
  it("includes Exa steps when research is on", () => {
    const copy = getPlanGenerationLoaderCopy(true);
    expect(copy.messages.some((m) => m.toLowerCase().includes("exa"))).toBe(true);
    expect(copy.steps).toContain("Search the web via Exa");
  });

  it("omits Exa steps when research is off", () => {
    const copy = getPlanGenerationLoaderCopy(false);
    expect(copy.messages.some((m) => m.toLowerCase().includes("exa"))).toBe(false);
    expect(copy.steps).not.toContain("Search the web via Exa");
    expect(copy.steps).toContain("Generate the plan with llm_text_gen");
  });

  it("caps progress at 95 percent", () => {
    expect(planGenerationProgressPercent(0, 4)).toBe(25);
    expect(planGenerationProgressPercent(3, 4)).toBe(95);
    expect(planGenerationProgressPercent(99, 4)).toBe(95);
  });
});
