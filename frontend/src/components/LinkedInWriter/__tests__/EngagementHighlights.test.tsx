import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { EngagementHighlights } from "../components/PostAnalytics/EngagementHighlights";
import type { EngagementStats } from "../components/PostAnalytics/useEngagementStats";
import type { LinkedInPost } from "../../../services/postAnalyticsApi";

const bestPost = {
  id: "best",
  text: "AI is rewriting the rulebook for digital marketers",
  created_at: "2026-01-01T00:00:00.000Z",
  engagement: {
    reactions: 20,
    comments: 2,
    reposts: 1,
    impressions: 1000,
    engagement_rate: 0.075,
    clicks: 0,
    followers_gained: 1,
  },
  author: { name: "Test" },
  is_repost: false,
  is_company_post: false,
} as LinkedInPost;

const baseStats: EngagementStats = {
  totalPosts: 1,
  totalReactions: 20,
  totalComments: 2,
  totalReposts: 1,
  totalImpressions: 1000,
  avgEngagementRate: 0.075,
  totalClicks: 0,
  totalFollowersGained: 1,
  totalEngagements: 30,
  totalPageViewers: 10,
  totalReach: 500,
  avgCtr: null,
  bestPost,
  bestCtaPost: null,
};

describe("EngagementHighlights", () => {
  it("renders best post and performance pulse cross-link in one row", () => {
    const onOpenPerformancePulse = jest.fn();

    render(
      <EngagementHighlights
        stats={baseStats}
        onOpenPerformancePulse={onOpenPerformancePulse}
      />,
    );

    expect(screen.getByText("Best performing post")).toBeInTheDocument();
    expect(
      screen.getByText(/AI is rewriting the rulebook for digital marketers/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ready to act on your best (and weakest) posts?"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Act on top posts →" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector(".linkedin-content-analytics-highlights__row"),
    ).toBeTruthy();
  });
});
