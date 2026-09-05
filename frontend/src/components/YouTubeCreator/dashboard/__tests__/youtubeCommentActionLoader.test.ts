import { planGenerationProgressPercent } from "../../utils/youtubePlanGenerationLoader";
import {
  YOUTUBE_COMMENT_API_LOADER_INTERVAL_MS,
  YOUTUBE_COMMENT_DRAFT_LOADER_INTERVAL_MS,
  getYouTubeCommentActionLoaderCopy,
  youtubeCommentActionProgressPercent,
  type YouTubeCommentProgressAction,
} from "../youtubeCommentActionLoader";

const ACTIONS: YouTubeCommentProgressAction[] = [
  "draft",
  "send",
  "save",
  "delete",
  "hide",
  "hideUser",
];

describe("youtubeCommentActionLoader", () => {
  it("gives each action its own title and steps", () => {
    const titles = ACTIONS.map(
      (action) => getYouTubeCommentActionLoaderCopy(action).title,
    );
    expect(new Set(titles).size).toBe(6);
    expect(getYouTubeCommentActionLoaderCopy("draft").title).toBe("Drafting reply");
    expect(getYouTubeCommentActionLoaderCopy("send").title).toBe("Sending reply");
    expect(getYouTubeCommentActionLoaderCopy("save").title).toBe("Saving edit");
    expect(getYouTubeCommentActionLoaderCopy("delete").title).toBe("Deleting reply");
    expect(getYouTubeCommentActionLoaderCopy("hide").title).toBe("Hiding comment");
    expect(getYouTubeCommentActionLoaderCopy("hideUser").title).toBe(
      "Hiding user from channel",
    );
    expect(getYouTubeCommentActionLoaderCopy("draft").steps).toEqual([
      "Apply your channel voice",
      "Read the comment",
      "Draft the reply",
      "Ready to edit",
    ]);
    expect(getYouTubeCommentActionLoaderCopy("send").steps).toEqual([
      "Check your draft",
      "Post to YouTube",
      "Confirm",
    ]);
    expect(getYouTubeCommentActionLoaderCopy("save").steps).toEqual([
      "Keep your edit",
      "Update on YouTube",
      "Confirm",
    ]);
    expect(getYouTubeCommentActionLoaderCopy("hide").steps).toEqual([
      "Confirm hide",
      "Update on YouTube",
      "Confirm",
    ]);
    expect(getYouTubeCommentActionLoaderCopy("hideUser").steps).toEqual([
      "Confirm hide user",
      "Update on YouTube",
      "Confirm",
    ]);
  });

  it("ticks draft slower than YouTube API jobs", () => {
    expect(getYouTubeCommentActionLoaderCopy("draft").intervalMs).toBe(
      YOUTUBE_COMMENT_DRAFT_LOADER_INTERVAL_MS,
    );
    expect(YOUTUBE_COMMENT_DRAFT_LOADER_INTERVAL_MS).toBe(4000);
    expect(YOUTUBE_COMMENT_API_LOADER_INTERVAL_MS).toBe(1200);
    for (const action of ["send", "save", "delete", "hide", "hideUser"] as const) {
      expect(getYouTubeCommentActionLoaderCopy(action).intervalMs).toBe(
        YOUTUBE_COMMENT_API_LOADER_INTERVAL_MS,
      );
    }
  });

  it("reuses typical-step progress and never leaks internals", () => {
    const draft = getYouTubeCommentActionLoaderCopy("draft");
    expect(youtubeCommentActionProgressPercent(0, draft.messages.length)).toBe(
      planGenerationProgressPercent(0, draft.messages.length),
    );
    const blob = ACTIONS.map((action) => {
      const copy = getYouTubeCommentActionLoaderCopy(action);
      return [copy.title, copy.hint, ...copy.messages, ...copy.steps].join(" ");
    }).join(" ");
    expect(blob.toLowerCase()).not.toMatch(/llm_text_gen|exa|channel bible|google|comment_id/);
    expect(draft.hint).toMatch(/little while/i);
    expect(draft.hint).toMatch(/typical steps/i);
    expect(getYouTubeCommentActionLoaderCopy("delete").hint).not.toMatch(/minute/i);
    expect(getYouTubeCommentActionLoaderCopy("delete").hint).toMatch(/typical steps/i);
    expect(youtubeCommentActionProgressPercent(99, 3)).toBeLessThanOrEqual(95);
  });
});
