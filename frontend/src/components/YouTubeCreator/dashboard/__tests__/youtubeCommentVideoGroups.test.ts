/**
 * Group Comment Reply Assistant inbox rows by video_id.
 * Same data as GET inbox; never invents titles.
 */
import {
  YOUTUBE_COMMENT_VIDEO_UNAVAILABLE_GROUP_KEY,
  groupYouTubeInboxCommentsByVideo,
  youtubeCommentCountLabel,
  youtubeCommentReplyCountLabel,
} from "../youtubeCommentVideoGroups";

describe("groupYouTubeInboxCommentsByVideo", () => {
  it("puts comments with the same video_id in one group with the real title", () => {
    const groups = groupYouTubeInboxCommentsByVideo([
      {
        comment_id: "c-1",
        video_id: "abcdefghijk",
        video_title: "Rank Videos in 7 Days",
        author: "Sam",
      },
      {
        comment_id: "c-2",
        video_id: "abcdefghijk",
        video_title: "Rank Videos in 7 Days",
        author: "Pat",
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("abcdefghijk");
    expect(groups[0].heading).toBe("Rank Videos in 7 Days");
    expect(groups[0].comments).toHaveLength(2);
    expect(groups[0].comments.map((c) => c.comment_id)).toEqual(["c-1", "c-2"]);
  });

  it("keeps separate videos in first-appearance order", () => {
    const groups = groupYouTubeInboxCommentsByVideo([
      {
        comment_id: "c-1",
        video_id: "vid-aaa",
        video_title: "First upload",
      },
      {
        comment_id: "c-2",
        video_id: "vid-bbb",
        video_title: "Second upload",
      },
      {
        comment_id: "c-3",
        video_id: "vid-aaa",
        video_title: "First upload",
      },
    ]);

    expect(groups.map((g) => g.key)).toEqual(["vid-aaa", "vid-bbb"]);
    expect(groups[0].comments.map((c) => c.comment_id)).toEqual(["c-1", "c-3"]);
    expect(groups[1].comments).toHaveLength(1);
    expect(groups[1].heading).toBe("Second upload");
  });

  it("groups missing video_id as Video unavailable without a fake title", () => {
    const groups = groupYouTubeInboxCommentsByVideo([
      { comment_id: "c-1", author: "Sam" },
      { comment_id: "c-2", video_id: "  ", video_title: "  " },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe("Video unavailable");
    expect(groups[0].key).toBe(YOUTUBE_COMMENT_VIDEO_UNAVAILABLE_GROUP_KEY);
    expect(groups[0].comments).toHaveLength(2);
    expect(groups[0].heading.toLowerCase()).not.toContain("untitled");
  });

  it("returns an empty list when there are no comments", () => {
    expect(groupYouTubeInboxCommentsByVideo([])).toEqual([]);
    expect(groupYouTubeInboxCommentsByVideo(null as never)).toEqual([]);
    expect(groupYouTubeInboxCommentsByVideo(undefined as never)).toEqual([]);
  });

  it("trims video_id so the same upload is one group", () => {
    const groups = groupYouTubeInboxCommentsByVideo([
      { comment_id: "c-1", video_id: " vid-aaa ", video_title: "First upload" },
      { comment_id: "c-2", video_id: "vid-aaa", video_title: "First upload" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("vid-aaa");
    expect(groups[0].comments).toHaveLength(2);
  });

  it("uses a short id heading when the API title is missing", () => {
    const groups = groupYouTubeInboxCommentsByVideo([
      { comment_id: "c-1", video_id: "abcdefghijk", video_title: "  " },
    ]);
    expect(groups[0].heading).toBe("abcdefgh");
    expect(groups[0].heading).not.toBe("abcdefghijk");
  });

  it("skips invalid rows so grouping cannot fail the inbox", () => {
    const groups = groupYouTubeInboxCommentsByVideo([
      null as never,
      { comment_id: "c-1", video_id: "vid-aaa", video_title: "First upload" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].comments).toHaveLength(1);
  });
});

describe("youtubeCommentReplyCountLabel", () => {
  it("uses singular and plural Studio copy", () => {
    expect(youtubeCommentReplyCountLabel(1)).toBe("1 reply");
    expect(youtubeCommentReplyCountLabel(2)).toBe("2 replies");
    expect(youtubeCommentReplyCountLabel(0)).toBe("0 replies");
  });
});
