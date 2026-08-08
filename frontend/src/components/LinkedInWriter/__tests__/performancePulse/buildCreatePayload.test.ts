import type { LinkedInPost } from "../../../../services/postAnalyticsApi";
import { buildPerformancePulseCreatePayload } from "../../components/dashboard/performancePulse/payload";

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

describe("buildPerformancePulseCreatePayload", () => {
  it("routes post content with post-specific reference label", () => {
    const post = makePost({ text: "Hook line.\n\nBody insight." });
    const payload = buildPerformancePulseCreatePayload(post, "repurpose", "post");

    expect(payload.reference_context).toContain("REFERENCE POST");
    expect(payload.reference_context).toContain("Hook line.");
    expect(payload.key_points).toContain("Fresh hook");
  });

  it("routes article content with article intent and title topic", () => {
    const post = makePost({
      text: "Long body ".repeat(200),
      title: "My Article Title",
    });
    const payload = buildPerformancePulseCreatePayload(
      post,
      "write_more",
      "article",
    );

    expect(payload.topic).toBe("My Article Title");
    expect(payload.reference_context).toContain("REFERENCE ARTICLE");
    expect(payload.reference_context).toContain("long-form");
    expect(payload.key_points).toContain("New angle");
  });

  it("routes carousel content with slide-oriented outline", () => {
    const post = makePost({
      text: "Swipe for tips on growth",
      attachments: [{ type: "document", url: "https://example.com/c.pdf" }],
    });
    const payload = buildPerformancePulseCreatePayload(
      post,
      "repurpose",
      "carousel",
    );

    expect(payload.reference_context).toContain("REFERENCE CAROUSEL POST");
    expect(payload.key_points).toContain("Slide 1");
  });

  it("routes video content with script-oriented outline", () => {
    const post = makePost({
      text: "Watch how we scaled outbound",
      attachments: [{ type: "video", url: "https://example.com/v.mp4" }],
    });
    const payload = buildPerformancePulseCreatePayload(
      post,
      "write_more",
      "video_script",
    );

    expect(payload.reference_context).toContain("REFERENCE VIDEO POST");
    expect(payload.key_points).toContain("hook");
  });
});
