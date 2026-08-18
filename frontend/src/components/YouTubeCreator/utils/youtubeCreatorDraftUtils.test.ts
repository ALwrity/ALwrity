import { hasYouTubeCreatorDraft } from "./youtubeCreatorDraftUtils";

describe("hasYouTubeCreatorDraft", () => {
  it("returns false for empty default-like state", () => {
    expect(
      hasYouTubeCreatorDraft({
        userIdea: "",
        videoPlan: null,
        scenes: [],
        renderTaskId: null,
      }),
    ).toBe(false);
  });

  it("returns true when userIdea is set", () => {
    expect(
      hasYouTubeCreatorDraft({
        userIdea: "Budget travel",
        videoPlan: null,
        scenes: [],
        renderTaskId: null,
      }),
    ).toBe(true);
  });

  it("returns true when scenes exist from a prior video", () => {
    expect(
      hasYouTubeCreatorDraft({
        userIdea: "",
        videoPlan: null,
        scenes: [{ scene_number: 1 } as never],
        renderTaskId: null,
      }),
    ).toBe(true);
  });

  it("returns true when render task is in progress", () => {
    expect(
      hasYouTubeCreatorDraft({
        userIdea: "",
        videoPlan: null,
        scenes: [],
        renderTaskId: "task_123",
      }),
    ).toBe(true);
  });
});
