import type { LinkedInPost } from "../../../services/postAnalyticsApi";
import { toPerformancePulseItem } from "../../components/dashboard/performancePulse/inferContentType";
import {
  countPerformancePulseByFilter,
  filterPerformancePulseItems,
  getTransformTargetFormats,
  rankPerformancePulseItems,
} from "../../components/dashboard/performancePulse/performancePulseRanking";
import { getTransformFormatsForSource } from "../../components/dashboard/performancePulse/repurposeFormats";

function makePost(
  overrides: Partial<LinkedInPost> & Pick<LinkedInPost, "text">,
): LinkedInPost {
  return {
    id: "p1",
    created_at: "2026-01-01T00:00:00Z",
    engagement: {
      reactions: 0,
      comments: 0,
      reposts: 0,
      impressions: 0,
      engagement_rate: 0.05,
      clicks: 0,
      followers_gained: 0,
    },
    author: { name: "Test User" },
    is_repost: false,
    is_company_post: false,
    ...overrides,
  };
}

describe("rankPerformancePulseItems", () => {
  it("returns top 3 by engagement rate and lowest outside top 3 (all filter)", () => {
    const posts = [
      makePost({ id: "low", text: "low", engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.01, clicks: 0, followers_gained: 0 } }),
      makePost({ id: "mid", text: "mid", engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.05, clicks: 0, followers_gained: 0 } }),
      makePost({ id: "high", text: "high", engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.09, clicks: 0, followers_gained: 0 } }),
      makePost({ id: "top", text: "top", engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.12, clicks: 0, followers_gained: 0 } }),
    ];

    const { top, bottom } = rankPerformancePulseItems(posts, "all");

    expect(top.map((item) => item.post.id)).toEqual(["top", "high", "mid"]);
    expect(bottom?.post.id).toBe("low");
  });

  it("omits bottom when only three or fewer items", () => {
    const posts = [
      makePost({ id: "a", text: "a", engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.2, clicks: 0, followers_gained: 0 } }),
      makePost({ id: "b", text: "b", engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.1, clicks: 0, followers_gained: 0 } }),
    ];

    const { top, bottom } = rankPerformancePulseItems(posts, "all");

    expect(top).toHaveLength(2);
    expect(bottom).toBeNull();
  });

  it("ranks within carousel filter only", () => {
    const posts = [
      makePost({
        id: "post-high",
        text: "plain post",
        engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.99, clicks: 0, followers_gained: 0 },
      }),
      makePost({
        id: "carousel-low",
        text: "carousel low",
        attachments: [{ type: "document", url: "https://example.com/a.pdf" }],
        engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.02, clicks: 0, followers_gained: 0 },
      }),
      makePost({
        id: "carousel-high",
        text: "carousel high",
        attachments: [{ type: "document", url: "https://example.com/b.pdf" }],
        engagement: { reactions: 0, comments: 0, reposts: 0, impressions: 0, engagement_rate: 0.08, clicks: 0, followers_gained: 0 },
      }),
    ];

    const { top, bottom } = rankPerformancePulseItems(posts, "carousel");

    expect(top.map((item) => item.post.id)).toEqual([
      "carousel-high",
      "carousel-low",
    ]);
    expect(bottom).toBeNull();
    expect(top.every((item) => item.contentType === "carousel")).toBe(true);
  });

  it("returns empty top when filter has no matching items", () => {
    const posts = [
      makePost({ id: "only-post", text: "plain post" }),
    ];

    const { top, bottom } = rankPerformancePulseItems(posts, "carousel");

    expect(top).toHaveLength(0);
    expect(bottom).toBeNull();
  });
});

describe("filterPerformancePulseItems", () => {
  it("filters enriched items by content type", () => {
    const posts = [
      makePost({
        id: "v1",
        text: "video",
        attachments: [{ type: "video", url: "https://example.com/v.mp4" }],
      }),
      makePost({ id: "p1", text: "plain" }),
    ];

    const items = posts.map(toPerformancePulseItem);
    const filtered = filterPerformancePulseItems(items, "video_script");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].post.id).toBe("v1");
  });
});

describe("countPerformancePulseByFilter", () => {
  it("counts items per format", () => {
    const posts = [
      makePost({
        id: "v1",
        text: "video",
        attachments: [{ type: "video", url: "https://example.com/v.mp4" }],
      }),
      makePost({ id: "p1", text: "plain" }),
      makePost({ id: "p2", text: "plain 2" }),
    ];

    const items = posts.map(toPerformancePulseItem);
    const counts = countPerformancePulseByFilter(items);

    expect(counts.all).toBe(3);
    expect(counts.video_script).toBe(1);
    expect(counts.post).toBe(2);
    expect(counts.carousel).toBe(0);
  });
});

describe("transform format helpers", () => {
  it("excludes source type from transform targets", () => {
    expect(getTransformTargetFormats("carousel")).toEqual([
      "post",
      "article",
      "video_script",
    ]);
    expect(getTransformFormatsForSource("post")).toHaveLength(3);
    expect(
      getTransformFormatsForSource("post").every((f) => f.type !== "post"),
    ).toBe(true);
  });
});
