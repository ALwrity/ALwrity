import {
  buildOutlineKeyPoints,
  buildPostPulseCreatePayload,
  buildReferenceContext,
  extractContentBullets,
  extractPostTopic,
} from "../components/dashboard/postPulseCreateUtils";
import type { LinkedInPost } from "../../../services/postAnalyticsApi";

function makePost(overrides: Partial<LinkedInPost> & Pick<LinkedInPost, "text">): LinkedInPost {
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

describe("postPulseCreateUtils", () => {
  describe("extractPostTopic", () => {
    it("uses the first line of post text as topic", () => {
      const post = makePost({
        text: "AI is rewriting the rulebook for digital marketers—are you ready?\n\nIn 2026, generative AI will change everything.",
        title: "Post",
      });
      expect(extractPostTopic(post)).toBe(
        "AI is rewriting the rulebook for digital marketers—are you ready?",
      );
    });

    it("ignores generic titles when post body exists", () => {
      const post = makePost({
        text: "Real hook about leadership lessons.",
        title: "Post",
      });
      expect(extractPostTopic(post)).toBe("Real hook about leadership lessons.");
    });

    it("falls back to meaningful title when body is empty", () => {
      const post = makePost({ text: "", title: "My campaign launch recap" });
      expect(extractPostTopic(post)).toBe("My campaign launch recap");
    });
  });

  describe("buildOutlineKeyPoints", () => {
    it("returns slash-separated outline bullets, not the full post", () => {
      const post = makePost({
        text: "AI is rewriting marketing.\n\nTeams that adapt early will win.\n\n#AI #Marketing",
      });
      const keyPoints = buildOutlineKeyPoints(post, "write_more");
      expect(keyPoints).toContain(" / ");
      expect(keyPoints).not.toContain("REFERENCE POST");
      expect(keyPoints).not.toContain("#AI #Marketing");
    });

    it("includes structure hints for repurpose mode", () => {
      const post = makePost({ text: "Short post." });
      const keyPoints = buildOutlineKeyPoints(post, "repurpose");
      expect(keyPoints).toContain("Fresh hook");
    });
  });

  describe("buildReferenceContext", () => {
    it("keeps full post in reference context, separate from outline", () => {
      const post = makePost({ text: "Original winning post content." });
      const reference = buildReferenceContext(post, "repurpose");
      expect(reference).toContain("CREATION INTENT");
      expect(reference).toContain("Original winning post content.");
      expect(reference).not.toContain("Fresh hook");
    });
  });

  describe("buildPostPulseCreatePayload", () => {
    it("maps topic, outline key points, and reference context separately", () => {
      const post = makePost({
        text: "Hook line here.\n\nSecond paragraph insight.\n\nThird insight.",
      });
      const payload = buildPostPulseCreatePayload(post, "write_more");
      expect(payload.topic).toBe("Hook line here.");
      expect(payload.key_points.split(" / ").length).toBeGreaterThanOrEqual(2);
      expect(payload.reference_context).toContain("Hook line here.");
      expect(payload.reference_mode).toBe("write_more");
    });
  });

  describe("extractContentBullets", () => {
    it("skips hashtag-only blocks", () => {
      const post = makePost({
        text: "Main insight here.\n\n#AI #Marketing #Growth",
      });
      const bullets = extractContentBullets(post);
      expect(bullets).toHaveLength(1);
      expect(bullets[0]).toContain("Main insight");
    });
  });
});
