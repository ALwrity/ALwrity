import {
  IDEA_FORMAT_CREATE_ACTIONS,
  SAVED_IDEAS_FORMAT_ORDER,
  TOPIC_IDEAS_FORMAT_ORDER,
  getIdeaFormatActionPresentation,
  getOrderedIdeaFormatActions,
} from "../utils/ideaFormatCreateActions";

describe("ideaFormatCreateActions", () => {
  it("exposes post and article unlocked, video and carousel locked", () => {
    const locked = IDEA_FORMAT_CREATE_ACTIONS.filter((a) => a.locked).map(
      (a) => a.type,
    );
    const unlocked = IDEA_FORMAT_CREATE_ACTIONS.filter((a) => !a.locked).map(
      (a) => a.type,
    );
    expect(unlocked).toEqual(["post", "article"]);
    expect(locked).toEqual(["video_script", "carousel"]);
  });

  it("orders Topic Ideas buttons as Post, Article, then locked formats", () => {
    expect(
      getOrderedIdeaFormatActions(TOPIC_IDEAS_FORMAT_ORDER).map((a) => a.type),
    ).toEqual(["post", "article", "video_script", "carousel"]);
  });

  it("orders Saved Ideas buttons with locked formats before create actions", () => {
    expect(
      getOrderedIdeaFormatActions(SAVED_IDEAS_FORMAT_ORDER).map((a) => a.type),
    ).toEqual(["video_script", "carousel", "post", "article"]);
  });

  it("returns icon and tonal colors for each action", () => {
    for (const action of IDEA_FORMAT_CREATE_ACTIONS) {
      const presentation = getIdeaFormatActionPresentation(action);
      expect(presentation.icon).toBeTruthy();
      expect(presentation.colors.bg).toBeTruthy();
      expect(presentation.lockedHint).toMatch(/coming soon/i);
    }
  });
});
