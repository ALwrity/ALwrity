import {
  consumePendingOpenCreator,
  openYouTubeCreator,
  openYouTubePlanFromCreator,
  parseYouTubeStudioTab,
  publishYouTubeSearchResults,
  queueYouTubeCreatorOpen,
  resumeYouTubeDraft,
  YT_CLOSE_CREATOR_EVENT,
  YT_OPEN_CREATOR_EVENT,
  YT_OPEN_WEDGE_EVENT,
  YT_SEARCH_RESULTS_EVENT,
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

describe("openYouTubePlanFromCreator", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("queues Plan drill-down, closes Creator, and opens Plan wedge", () => {
    const closed: unknown[] = [];
    const wedges: unknown[] = [];
    const onClose = () => closed.push(true);
    const onWedge = (e: Event) => wedges.push((e as CustomEvent).detail);

    window.addEventListener(YT_CLOSE_CREATOR_EVENT, onClose);
    window.addEventListener(YT_OPEN_WEDGE_EVENT, onWedge);

    openYouTubePlanFromCreator({ sub: "url-import", seed: "From Creator" });

    expect(closed).toEqual([true]);
    expect(wedges).toEqual([{ wedge: "plan", sub: "url-import" }]);

    window.removeEventListener(YT_CLOSE_CREATOR_EVENT, onClose);
    window.removeEventListener(YT_OPEN_WEDGE_EVENT, onWedge);
  });
});

describe("openYouTubeCreator — discovery retarget to Plan", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("retargets focusUrlImport to Plan url-import drill-down", () => {
    const wedges: unknown[] = [];
    const onWedge = (e: Event) => wedges.push((e as CustomEvent).detail);
    const opened: unknown[] = [];
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail);

    window.addEventListener(YT_OPEN_WEDGE_EVENT, onWedge);
    window.addEventListener(YT_OPEN_CREATOR_EVENT, onOpen);

    openYouTubeCreator({ step: 0, userIdea: "Blog post", focusUrlImport: true });

    expect(wedges).toEqual([{ wedge: "plan", sub: "url-import" }]);
    expect(opened).toEqual([]);
    expect(consumePendingOpenCreator()).toBeNull();

    window.removeEventListener(YT_OPEN_WEDGE_EVENT, onWedge);
    window.removeEventListener(YT_OPEN_CREATOR_EVENT, onOpen);
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

describe("publishYouTubeSearchResults", () => {
  it("dispatches Hub search results without logging the query text", () => {
    const seen: unknown[] = [];
    const onResults = (event: Event) => {
      seen.push((event as CustomEvent).detail);
    };
    window.addEventListener(YT_SEARCH_RESULTS_EVENT, onResults);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    publishYouTubeSearchResults({
      query: "secret keyword",
      items: [{ video_id: "vid123", title: "How to train dogs" }],
      message: null,
    });

    expect(seen).toEqual([
      {
        query: "secret keyword",
        items: [{ video_id: "vid123", title: "How to train dogs" }],
        message: null,
      },
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret keyword");
    expect(info).toHaveBeenCalledWith(
      "[youtubeStudioEvents] publishYouTubeSearchResults",
      expect.objectContaining({
        queryLength: 14,
        itemCount: 1,
        hasMessage: false,
      }),
    );

    info.mockRestore();
    window.removeEventListener(YT_SEARCH_RESULTS_EVENT, onResults);
  });
});
