import type { EngagementSummary, PostDelta } from '../../../../services/postAnalyticsApi';

/** True when aggregate summary shows any positive metric movement. */
export function hasPositiveAggregateGrowth(summary: EngagementSummary): boolean {
  return (
    summary.reactions.delta > 0 ||
    summary.comments.delta > 0 ||
    summary.impressions.delta > 0
  );
}

function postGrowthScore(post: PostDelta): number {
  return post.reactions_delta + post.comments_delta + post.impressions_delta;
}

/** Show contribution badges only when at least one gainer has attributed positive growth. */
export function shouldShowContributionBadges(gainers: PostDelta[]): boolean {
  return gainers.some(
    (post) =>
      postGrowthScore(post) > 0 &&
      post.growth_contribution_pct != null &&
      post.growth_contribution_pct > 0,
  );
}
