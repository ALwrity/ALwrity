import { boostPerformanceContent } from "../../components/dashboard/performancePulse/boostPerformanceContent";
import { optimizeForEngagement } from "../../components/dashboard/engagementBoosterApi";
import type { LinkedInPost } from "../../../../services/postAnalyticsApi";

jest.mock("../../components/dashboard/engagementBoosterApi", () => ({
  optimizeForEngagement: jest.fn(),
}));

function makePost(text: string): LinkedInPost {
  return {
    id: "p1",
    text,
    created_at: "2026-01-01T00:00:00Z",
    engagement: {
      reactions: 0,
      comments: 0,
      reposts: 0,
      impressions: 0,
      engagement_rate: 0.01,
      clicks: 0,
      followers_gained: 0,
    },
    author: { name: "Test" },
    is_repost: false,
    is_company_post: false,
  };
}

describe("boostPerformanceContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes content_type to optimizeForEngagement", async () => {
    (optimizeForEngagement as jest.Mock).mockResolvedValue({
      success: true,
      content: "Improved article caption",
    });

    await boostPerformanceContent(makePost("Original article text"), "article");

    expect(optimizeForEngagement).toHaveBeenCalledWith("Original article text", {
      contentType: "article",
    });
  });

  it("returns error when post text is empty", async () => {
    const result = await boostPerformanceContent(makePost(""), "post");

    expect(result.success).toBe(false);
    expect(optimizeForEngagement).not.toHaveBeenCalled();
  });
});
