import {
  consumePendingOpenCreator,
  parseYouTubeStudioTab,
  queueYouTubeCreatorOpen,
} from "./youtubeStudioEvents";

describe("parseYouTubeStudioTab", () => {
  it("defaults to creator when tab is missing or unknown", () => {
    expect(parseYouTubeStudioTab(null)).toBe("creator");
    expect(parseYouTubeStudioTab(undefined)).toBe("creator");
    expect(parseYouTubeStudioTab("")).toBe("creator");
    expect(parseYouTubeStudioTab("studio")).toBe("creator");
  });

  it("only treats hub as Studio Hub", () => {
    expect(parseYouTubeStudioTab("hub")).toBe("hub");
    expect(parseYouTubeStudioTab("creator")).toBe("creator");
  });
});

describe("queueYouTubeCreatorOpen", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores pending detail for Video Creator after a hub deep-link", () => {
    queueYouTubeCreatorOpen({ step: 2, userIdea: "From hub" });
    const pending = consumePendingOpenCreator();
    expect(pending).toEqual({ step: 2, userIdea: "From hub" });
    expect(consumePendingOpenCreator()).toBeNull();
  });
});
