import type { LinkedInPost } from "../../../services/postAnalyticsApi";
import { inferPerformanceContentType } from "../../components/dashboard/performancePulse/inferContentType";

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

describe("inferPerformanceContentType", () => {
  it("classifies video attachments as video_script", () => {
    const post = makePost({
      text: "Short caption",
      attachments: [{ type: "video", url: "https://example.com/v.mp4" }],
    });
    expect(inferPerformanceContentType(post)).toBe("video_script");
  });

  it("classifies document attachments as carousel", () => {
    const post = makePost({
      text: "Swipe through these slides",
      attachments: [{ type: "document", url: "https://example.com/doc.pdf" }],
    });
    expect(inferPerformanceContentType(post)).toBe("carousel");
  });

  it("classifies long-form text as article", () => {
    const post = makePost({
      text: "A".repeat(1600),
    });
    expect(inferPerformanceContentType(post)).toBe("article");
  });

  it("classifies pulse URLs as article", () => {
    const post = makePost({
      text: "Read more https://www.linkedin.com/pulse/my-article-title",
    });
    expect(inferPerformanceContentType(post)).toBe("article");
  });

  it("defaults plain text posts to post", () => {
    const post = makePost({
      text: "A short professional update about team wins.",
    });
    expect(inferPerformanceContentType(post)).toBe("post");
  });

  it("prefers video over document when both present", () => {
    const post = makePost({
      text: "Mixed media",
      attachments: [
        { type: "document", url: "https://example.com/doc.pdf" },
        { type: "video", url: "https://example.com/v.mp4" },
      ],
    });
    expect(inferPerformanceContentType(post)).toBe("video_script");
  });
});
