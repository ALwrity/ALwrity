import type { LinkedInPost } from "../../../services/postAnalyticsApi";
import { resolvePerformanceContentType } from "../../components/dashboard/performancePulse/resolvePerformanceContentType";

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

describe("resolvePerformanceContentType", () => {
  it("prefers persisted API content_type over inference", () => {
    const post = makePost({
      text: "A".repeat(1600),
      content_type: "post",
    });
    expect(resolvePerformanceContentType(post)).toBe("post");
  });

  it("falls back to inference when content_type is absent", () => {
    const post = makePost({
      text: "A".repeat(1600),
    });
    expect(resolvePerformanceContentType(post)).toBe("article");
  });

  it("falls back to inference for unknown API values", () => {
    const post = makePost({
      text: "Short update",
      content_type: "unknown" as LinkedInPost["content_type"],
    });
    expect(resolvePerformanceContentType(post)).toBe("post");
  });
});
