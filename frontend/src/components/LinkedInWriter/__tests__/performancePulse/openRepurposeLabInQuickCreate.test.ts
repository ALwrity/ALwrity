import type { LinkedInPost } from "../../../../services/postAnalyticsApi";
import { openQuickCreateFromWedge } from "../../components/dashboard/engagementWedgeNavigation";
import { REMARKET_RETURN } from "../../components/dashboard/remarketWedgeNavigation";
import {
  coercePerformanceContentType,
  openRepurposeLabInQuickCreate,
} from "../../components/dashboard/performancePulse/openPerformanceContentInQuickCreate";
import { buildPerformancePulseCreatePayload } from "../../components/dashboard/performancePulse/payload";

jest.mock("../../components/dashboard/engagementWedgeNavigation", () => ({
  openQuickCreateFromWedge: jest.fn(),
}));

function makePost(text: string): LinkedInPost {
  return {
    id: "p1",
    text,
    title: "Winner Post",
    created_at: "2026-01-01T00:00:00Z",
    engagement: {
      reactions: 10,
      comments: 2,
      reposts: 1,
      impressions: 100,
      engagement_rate: 0.08,
      clicks: 0,
      followers_gained: 0,
    },
    author: { name: "Test" },
    is_repost: false,
    is_company_post: false,
  };
}

describe("openRepurposeLabInQuickCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes rich repurpose payload and Remarket return target", () => {
    const post = makePost("Swipe for 5 growth tips on LinkedIn.");
    openRepurposeLabInQuickCreate(post, "carousel", REMARKET_RETURN.repurpose);

    const expected = buildPerformancePulseCreatePayload(
      post,
      "repurpose",
      "carousel",
    );

    expect(openQuickCreateFromWedge).toHaveBeenCalledWith({
      type: "carousel",
      topic: expected.topic,
      key_points: expected.key_points,
      reference_context: expected.reference_context,
      reference_mode: "repurpose",
      returnTo: REMARKET_RETURN.repurpose,
    });
  });

  it("defaults unknown format types to post", () => {
    expect(coercePerformanceContentType("unknown")).toBe("post");
    expect(coercePerformanceContentType("video_script")).toBe("video_script");
  });
});
