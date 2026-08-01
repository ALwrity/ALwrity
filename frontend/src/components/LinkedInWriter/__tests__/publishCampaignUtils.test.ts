/**
 * Unit tests for Publish Campaign assembly and ROI heuristics.
 */

import {
  buildPublishCampaignPayload,
  roiTierLabel,
  type CalendarEventRecord,
} from "../utils/publishCampaignUtils";
import type { LinkedInDraftAsset } from "../utils/linkedInDraftLibraryUtils";

const scheduledPost = (): CalendarEventRecord => ({
  id: 1,
  title: "AI trends in SaaS",
  description:
    "Artificial intelligence is reshaping SaaS products across onboarding, support, and analytics for modern teams.",
  content_type: "post",
  platform: "linkedin",
  scheduled_date: new Date(Date.now() + 86400000 * 2).toISOString(),
  status: "scheduled",
});

const readyDraft = (): LinkedInDraftAsset => ({
  id: "99",
  title: "Unique draft topic",
  description: "",
  created_at: new Date().toISOString(),
  source_module: "linkedin_writer",
  asset_type: "text",
  asset_metadata: {
    content_type: "linkedin_post",
    content:
      "Leadership in remote teams requires clarity, async rituals, and trust built through consistent communication every week.",
    word_count: 18,
  },
});

describe("publishCampaignUtils", () => {
  test("roiTierLabel maps tiers", () => {
    expect(roiTierLabel("high")).toBe("High ROI");
    expect(roiTierLabel("medium")).toBe("Medium ROI");
    expect(roiTierLabel("low")).toBe("Low ROI");
  });

  test("buildPublishCampaignPayload merges calendar and drafts", () => {
    const payload = buildPublishCampaignPayload(
      [scheduledPost()],
      [readyDraft()],
      7,
    );
    expect(payload.items.length).toBe(2);
    expect(payload.scheduledCount).toBe(1);
    expect(payload.readyDraftCount).toBe(1);
    expect(payload.insights.length).toBeGreaterThan(0);
  });

  test("buildPublishCampaignPayload excludes non-linkedin events", () => {
    const payload = buildPublishCampaignPayload(
      [{ ...scheduledPost(), platform: "twitter" }],
      [],
      7,
    );
    expect(payload.items.length).toBe(0);
  });

  test("dedupes draft when same title on calendar", () => {
    const draft = readyDraft();
    draft.title = "AI trends in SaaS";
    const payload = buildPublishCampaignPayload([scheduledPost()], [draft], 7);
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].source).toBe("calendar");
  });
});
