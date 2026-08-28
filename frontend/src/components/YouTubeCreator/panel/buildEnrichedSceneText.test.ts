import type { Scene } from "../../../services/youtubeApi";
import {
  buildEnrichedSceneText,
  buildYoutubeSceneSpeechText,
  estimateYoutubeSpeechSeconds,
  warnIfYoutubeSpeechExceedsClip,
} from "./buildEnrichedSceneText";

const scene: Scene = {
  scene_number: 1,
  title: "Hook",
  narration: "Open with a question.",
  visual_prompt: "Airport gate",
  duration_estimate: 2,
  visual_cues: ["fast_cuts"],
  emphasis_tags: ["hook"],
};

describe("buildYoutubeSceneSpeechText", () => {
  it("sends narration only with no title prefix or bracket hints", () => {
    const speech = buildYoutubeSceneSpeechText(scene);
    const displayHints = buildEnrichedSceneText(scene);

    expect(speech).toBe("Open with a question.");
    expect(speech).toBe(scene.narration);
    expect(speech).not.toContain("Hook.");
    expect(speech).not.toMatch(/\[Speak at/i);
    expect(speech).not.toMatch(/\[Pacing:/i);
    expect(displayHints).toContain("Hook.");
    expect(displayHints).toMatch(/\[/);
  });

  it("returns empty string when narration is missing", () => {
    expect(buildYoutubeSceneSpeechText({ ...scene, narration: "  " })).toBe("");
  });
});

describe("youtube speech clock", () => {
  it("estimates spoken seconds at 150 WPM", () => {
    expect(estimateYoutubeSpeechSeconds("one two three four five six seven eight nine ten eleven twelve")).toBe(5);
  });

  it("warns when speech seconds exceed the WAN clip", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const longLine = Array(40).fill("word").join(" ");
    const clock = warnIfYoutubeSpeechExceedsClip(longLine, 5);
    expect(clock.clipSeconds).toBe(5);
    expect(clock.speechSeconds).toBeGreaterThan(5);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does not throw when duration estimate is invalid", () => {
    const clock = warnIfYoutubeSpeechExceedsClip("hello there", Number.NaN);
    expect(clock.clipSeconds).toBe(5);
    expect(clock.speechSeconds).toBeGreaterThanOrEqual(0);
  });
});
