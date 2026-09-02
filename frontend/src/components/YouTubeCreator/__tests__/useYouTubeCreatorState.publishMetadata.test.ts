/**
 * TDD: edited publish metadata must survive browser refresh via the creator draft.
 */
import {
  getYouTubeCreatorStateSnapshot,
  YOUTUBE_CREATOR_STATE_KEY,
} from "../../../hooks/useYouTubeCreatorState";

const edited = {
  title: "Edited title",
  description: "Edited description",
  tags: ["seo", "ranking"],
  category_id: "27",
};

describe("YouTube creator draft publish metadata persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores edited publish metadata from localStorage", () => {
    localStorage.setItem(
      YOUTUBE_CREATOR_STATE_KEY,
      JSON.stringify({
        userIdea: "Rank videos",
        publishMetadata: edited,
      }),
    );

    expect(getYouTubeCreatorStateSnapshot().publishMetadata).toEqual(edited);
  });

  it("returns null publish metadata when the saved value is invalid", () => {
    localStorage.setItem(
      YOUTUBE_CREATOR_STATE_KEY,
      JSON.stringify({
        publishMetadata: { title: 1, tags: "seo" },
      }),
    );

    expect(getYouTubeCreatorStateSnapshot().publishMetadata).toBeNull();
  });

  it("defaults publish metadata to null for drafts saved before this field existed", () => {
    localStorage.setItem(
      YOUTUBE_CREATOR_STATE_KEY,
      JSON.stringify({ userIdea: "Rank videos" }),
    );

    expect(getYouTubeCreatorStateSnapshot().publishMetadata).toBeNull();
  });
});
