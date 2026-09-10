/**
 * Knowledge Center FAQ must match the Hub catalog (Analysis vs Remarket vs Create).
 */
import { YOUTUBE_ASK_FAQ } from "../knowledgeCenterFeatures";

describe("YouTube Knowledge Center Analysis FAQ", () => {
  it("points Analysis at Pulse, Performance, and Analytics; Gaps on Remarket; SEO on Create", () => {
    const faq = YOUTUBE_ASK_FAQ.find((row) => row.q === "How do I use Analysis?");
    expect(faq?.a).toContain("Channel Pulse");
    expect(faq?.a).toContain("Video Performance");
    expect(faq?.a).toContain("Video Analytics");
    expect(faq?.a).toContain("Content Gaps lives on Remarket");
    expect(faq?.a).toContain("SEO audit is on Create");
    expect(faq?.a).not.toMatch(/retention/i);
  });
});
