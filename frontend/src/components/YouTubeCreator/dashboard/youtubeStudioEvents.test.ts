import {
  consumePendingOpenCreator,
  openYouTubeCreator,
  parseYouTubeStudioTab,
  queueYouTubeCreatorOpen,
  resumeYouTubeDraft,
  YT_OPEN_CREATOR_EVENT,
  YT_SWITCH_TAB_EVENT,
} from "./youtubeStudioEvents";

describe("parseYouTubeStudioTab — Hub-only shell", () => {
  it("always resolves to hub (including legacy ?tab=creator)", () => {
    expect(parseYouTubeStudioTab(null)).toBe("hub");
    expect(parseYouTubeStudioTab(undefined)).toBe("hub");
    expect(parseYouTubeStudioTab("")).toBe("hub");
    expect(parseYouTubeStudioTab("studio")).toBe("hub");
    expect(parseYouTubeStudioTab("hub")).toBe("hub");
    expect(parseYouTubeStudioTab("creator")).toBe("hub");
  });
});

describe("queueYouTubeCreatorOpen", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("stores pending detail for Video Creator after a hub deep-link", () => {
    queueYouTubeCreatorOpen({ step: 2, userIdea: "From hub" });
    const pending = consumePendingOpenCreator();
    expect(pending).toEqual({ step: 2, userIdea: "From hub" });
    expect(consumePendingOpenCreator()).toBeNull();
  });
});

describe("openYouTubeCreator — Full Creator modal host (no tab switch)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("queues detail and fires openCreator without switching to creator tab", () => {
    const opened: unknown[] = [];
    const tabs: unknown[] = [];
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail);
    const onTab = (e: Event) => tabs.push((e as CustomEvent).detail);

    window.addEventListener(YT_OPEN_CREATOR_EVENT, onOpen);
    window.addEventListener(YT_SWITCH_TAB_EVENT, onTab);

    openYouTubeCreator({ step: 0, durationType: "medium" });

    expect(opened).toEqual([{ step: 0, durationType: "medium" }]);
    expect(tabs.some((t) => (t as { tab?: string }).tab === "creator")).toBe(false);
    expect(consumePendingOpenCreator()).toEqual({ step: 0, durationType: "medium" });

    window.removeEventListener(YT_OPEN_CREATOR_EVENT, onOpen);
    window.removeEventListener(YT_SWITCH_TAB_EVENT, onTab);
  });
});

describe("resumeYouTubeDraft", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    consumePendingOpenCreator();
  });

  it("opens creator via openYouTubeCreator without switching to creator tab", () => {
    localStorage.setItem(
      "youtube_creator_state",
      JSON.stringify({ activeStep: 2 }),
    );
    const tabs: unknown[] = [];
    const opened: unknown[] = [];
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail);
    const onTab = (e: Event) => tabs.push((e as CustomEvent).detail);

    window.addEventListener(YT_OPEN_CREATOR_EVENT, onOpen);
    window.addEventListener(YT_SWITCH_TAB_EVENT, onTab);

    resumeYouTubeDraft();

    expect(opened).toEqual([{ step: 2 }]);
    expect(tabs.some((t) => (t as { tab?: string }).tab === "creator")).toBe(false);

    window.removeEventListener(YT_OPEN_CREATOR_EVENT, onOpen);
    window.removeEventListener(YT_SWITCH_TAB_EVENT, onTab);
  });
});
