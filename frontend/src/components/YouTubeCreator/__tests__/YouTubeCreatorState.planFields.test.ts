/**
 * Plan Your Video draft fields survive refresh via youtube_creator_state.
 */
import {
  getYouTubeCreatorStateSnapshot,
  patchYouTubeCreatorStateStorage,
  YOUTUBE_CREATOR_STATE_KEY,
} from "../../../hooks/useYouTubeCreatorState";

describe("YouTube creator draft Plan fields", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores idea, duration, type, audience, goal, style, and language", () => {
    localStorage.setItem(
      YOUTUBE_CREATOR_STATE_KEY,
      JSON.stringify({
        userIdea: "Budget travel packing",
        durationType: "shorts",
        videoType: "educational",
        targetAudience: "travelers",
        videoGoal: "educate",
        brandStyle: "cinematic",
        language: "hi",
      }),
    );

    const snapshot = getYouTubeCreatorStateSnapshot();
    expect(snapshot.userIdea).toBe("Budget travel packing");
    expect(snapshot.durationType).toBe("shorts");
    expect(snapshot.videoType).toBe("educational");
    expect(snapshot.targetAudience).toBe("travelers");
    expect(snapshot.videoGoal).toBe("educate");
    expect(snapshot.brandStyle).toBe("cinematic");
    expect(snapshot.language).toBe("hi");
  });

  it("uses Plan defaults when a saved draft omits those fields", () => {
    localStorage.setItem(
      YOUTUBE_CREATOR_STATE_KEY,
      JSON.stringify({ userIdea: "Rank videos" }),
    );

    const snapshot = getYouTubeCreatorStateSnapshot();
    expect(snapshot.durationType).toBe("medium");
    expect(snapshot.videoType).toBe("");
    expect(snapshot.language).toBe("en");
    expect(snapshot.enableResearch).toBe(true);
  });

  it("returns defaults when saved JSON is invalid", () => {
    localStorage.setItem(YOUTUBE_CREATOR_STATE_KEY, "{not-json");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const snapshot = getYouTubeCreatorStateSnapshot();
    expect(snapshot.userIdea).toBe("");
    expect(snapshot.durationType).toBe("medium");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("patches duration onto the saved draft without dropping the idea", () => {
    localStorage.setItem(
      YOUTUBE_CREATOR_STATE_KEY,
      JSON.stringify({ userIdea: "Budget travel packing", durationType: "shorts" }),
    );
    const next = patchYouTubeCreatorStateStorage({ durationType: "long" });
    expect(next.userIdea).toBe("Budget travel packing");
    expect(next.durationType).toBe("long");
    expect(getYouTubeCreatorStateSnapshot().durationType).toBe("long");
  });

  it("restores remaining Plan page fields from the saved draft", () => {
    localStorage.setItem(
      YOUTUBE_CREATOR_STATE_KEY,
      JSON.stringify({
        userIdea: "Budget travel packing",
        referenceImage: "bright classroom",
        avatarUrl: "https://cdn.example/face.png",
        enableResearch: false,
        creativeAngle: "Contrarian",
        currentPitch: {
          id: "pitch-1",
          creative_angle: "Contrarian",
          selected_title: "Stop Overpacking",
          video_summary: "Pack three items.",
          hook_concept: "Skip the suitcase.",
          main_content_beats: ["Rule one"],
        },
        scriptPhase: "pitch",
      }),
    );

    const snapshot = getYouTubeCreatorStateSnapshot();
    expect(snapshot.referenceImage).toBe("bright classroom");
    expect(snapshot.avatarUrl).toBe("https://cdn.example/face.png");
    expect(snapshot.enableResearch).toBe(false);
    expect(snapshot.creativeAngle).toBe("Contrarian");
    expect(snapshot.currentPitch?.selected_title).toBe("Stop Overpacking");
    expect(snapshot.scriptPhase).toBe("pitch");
  });
});
