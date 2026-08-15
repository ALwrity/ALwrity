import { useMemo } from "react";
import type { LinkedInPost } from "../../../../services/postAnalyticsApi";

export interface EngagementStats {
  totalPosts: number;
  totalReactions: number;
  totalComments: number;
  totalReposts: number;
  totalImpressions: number;
  avgEngagementRate: number;
  totalClicks: number;
  totalFollowersGained: number;
  totalEngagements: number | null;
  totalPageViewers: number | null;
  totalReach: number | null;
  avgCtr: number | null;
  bestPost: LinkedInPost | null;
  bestCtaPost: LinkedInPost | null;
}

const EMPTY_STATS: EngagementStats = {
  totalPosts: 0,
  totalReactions: 0,
  totalComments: 0,
  totalReposts: 0,
  totalImpressions: 0,
  avgEngagementRate: 0,
  totalClicks: 0,
  totalFollowersGained: 0,
  totalEngagements: null,
  totalPageViewers: null,
  totalReach: null,
  avgCtr: null,
  bestPost: null,
  bestCtaPost: null,
};

export function computeEngagementStats(posts: LinkedInPost[]): EngagementStats {
  if (posts.length === 0) {
    return EMPTY_STATS;
  }

  let totalReactions = 0;
  let totalComments = 0;
  let totalReposts = 0;
  let totalImpressions = 0;
  let totalEngagementRate = 0;
  let totalClicks = 0;
  let totalFollowersGained = 0;
  let totalEngagements = 0;
  let engagementsKnown = false;
  let totalPageViewers = 0;
  let pageViewersKnown = false;
  let totalReach = 0;
  let reachKnown = false;
  let bestPost: LinkedInPost | null = null;
  let bestScore = 0;
  let bestCtaPost: LinkedInPost | null = null;
  let bestClicks = 0;
  let ctrWeightedNum = 0;
  let ctrWeightedDen = 0;

  for (const post of posts) {
    const e = post.engagement;
    totalReactions += e.reactions;
    totalComments += e.comments;
    totalReposts += e.reposts;
    totalImpressions += e.impressions;
    totalEngagementRate += e.engagement_rate;
    totalClicks += e.clicks ?? 0;
    totalFollowersGained += e.followers_gained ?? 0;

    if (e.clickthrough_rate != null && e.impressions > 0) {
      const rate =
        e.clickthrough_rate > 1
          ? e.clickthrough_rate / 100
          : e.clickthrough_rate;
      ctrWeightedNum += rate * e.impressions;
      ctrWeightedDen += e.impressions;
    }

    if (e.engagements != null) {
      engagementsKnown = true;
      totalEngagements += e.engagements;
    }
    if (e.page_viewers != null) {
      pageViewersKnown = true;
      totalPageViewers += e.page_viewers;
    }
    if (e.reach != null) {
      reachKnown = true;
      totalReach += e.reach;
    }

    const score = e.engagement_rate * 1000 + e.reactions;
    if (score > bestScore) {
      bestScore = score;
      bestPost = post;
    }

    if ((e.clicks ?? 0) > bestClicks) {
      bestClicks = e.clicks ?? 0;
      bestCtaPost = post;
    }
  }

  return {
    totalPosts: posts.length,
    totalReactions,
    totalComments,
    totalReposts,
    totalImpressions,
    avgEngagementRate: totalEngagementRate / posts.length,
    totalClicks,
    totalFollowersGained,
    totalEngagements: engagementsKnown ? totalEngagements : null,
    totalPageViewers: pageViewersKnown ? totalPageViewers : null,
    totalReach: reachKnown ? totalReach : null,
    avgCtr:
      ctrWeightedDen > 0
        ? ctrWeightedNum / ctrWeightedDen
        : totalImpressions > 0
          ? totalClicks / totalImpressions
          : null,
    bestPost,
    bestCtaPost: bestClicks > 0 ? bestCtaPost : null,
  };
}

export function useEngagementStats(posts: LinkedInPost[]): EngagementStats {
  return useMemo(() => computeEngagementStats(posts), [posts]);
}
