import { getSceneBuildLoaderCopy, SCENE_BUILD_LOADER_STEPS } from "./youtubeSceneBuildLoader";
import { planGenerationProgressPercent } from "./youtubePlanGenerationLoader";

describe("youtubeSceneBuildLoader", () => {
  it("describes the scene_builder pipeline including llm_text_gen", () => {
    const copy = getSceneBuildLoaderCopy();
    expect(copy.messages.some((m) => m.toLowerCase().includes("llm_text_gen"))).toBe(true);
    expect(copy.steps).toEqual(SCENE_BUILD_LOADER_STEPS);
    expect(copy.steps).toContain("Generate scenes with llm_text_gen");
    expect(copy.steps).toContain("Enhance visual prompts");
  });

  it("uses the shared progress helper capped at 95 percent", () => {
    const { messages } = getSceneBuildLoaderCopy();
    expect(planGenerationProgressPercent(0, messages.length)).toBe(25);
    expect(planGenerationProgressPercent(messages.length - 1, messages.length)).toBe(95);
  });
});
