import type { LinkedInPost } from "../../../services/postAnalyticsApi";
import { buildOverviewMetricCards } from "../components/PostAnalytics/engagementMetricCards";
import { formatAnalyticsNumber } from "../components/PostAnalytics/formatAnalyticsNumber";
import { computeEngagementStats } from "../components/PostAnalytics/useEngagementStats";

function makePost(
  overrides: Partial<LinkedInPost> & {
    engagement?: Partial<LinkedInPost["engagement"]>;
  } = {},
): LinkedInPost {
  const { engagement, ...rest } = overrides;

  return {
    id: "post-1",
    text: "Sample post",
    created_at: "2026-01-01T00:00:00.000Z",
    engagement: {
      reactions: 10,
      comments: 2,
      reposts: 1,
      impressions: 1000,
      engagement_rate: 0.05,
      clicks: 4,
      followers_gained: 3,
      engagements: 20,
      page_viewers: 15,
      reach: 800,
      ...engagement,
    },
    author: { name: "Test User" },
    is_repost: false,
    is_company_post: false,
    ...rest,
  };
}

describe("formatAnalyticsNumber", () => {
  it("formats thousands and millions", () => {
    expect(formatAnalyticsNumber(999)).toBe("999");
    expect(formatAnalyticsNumber(1500)).toBe("1.5K");
    expect(formatAnalyticsNumber(2_500_000)).toBe("2.5M");
  });
});

describe("computeEngagementStats", () => {
  it("returns empty stats for no posts", () => {
    const stats = computeEngagementStats([]);
    expect(stats.totalPosts).toBe(0);
    expect(stats.bestPost).toBeNull();
  });

  it("aggregates totals and picks best post by engagement score", () => {
    const posts = [
      makePost({
        id: "a",
        text: "Lower engagement",
        engagement: {
          reactions: 5,
          comments: 0,
          reposts: 0,
          impressions: 100,
          engagement_rate: 0.02,
          clicks: 0,
          followers_gained: 0,
          engagements: 10,
          page_viewers: 10,
          reach: 500,
        },
      }),
      makePost({
        id: "b",
        text: "Top post",
        engagement: {
          reactions: 40,
          comments: 0,
          reposts: 0,
          impressions: 200,
          engagement_rate: 0.08,
          clicks: 0,
          followers_gained: 0,
          engagements: 30,
          page_viewers: 20,
          reach: 1100,
        },
      }),
    ];

    const stats = computeEngagementStats(posts);
    expect(stats.totalPosts).toBe(2);
    expect(stats.totalReactions).toBe(45);
    expect(stats.bestPost?.id).toBe("b");
    expect(stats.totalEngagements).toBe(40);
    expect(stats.totalPageViewers).toBe(30);
    expect(stats.totalReach).toBe(1600);
  });
});

describe("buildOverviewMetricCards", () => {
  it("returns the 10 overview metrics in display order", () => {
    const stats = computeEngagementStats([makePost()]);
    const cards = buildOverviewMetricCards(stats);

    expect(cards).toHaveLength(10);
    expect(cards.map((card) => card.label)).toEqual([
      "Posts",
      "Reactions",
      "Comments",
      "Reposts",
      "Impressions",
      "Avg. Engagement",
      "Engagements",
      "Page viewers",
      "Followers Gained",
      "Reached",
    ]);
    expect(cards[0].value).toBe("1");
    expect(cards[5].value).toBe("5.0%");
    expect(cards[8].value).toBe("+3");
  });
});
