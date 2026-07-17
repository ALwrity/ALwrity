/**
 * Plain-language copy for Engagement Since You Joined ALwrity (Phase 1+).
 * Keep product strings here so the modal stays thin and non-tech-friendly.
 */

export const ENGAGEMENT_SINCE_TITLE = 'Engagement Since You Joined ALwrity';

export const ENGAGEMENT_SINCE_SUBTITLE =
  'See how your posts grew in the time you pick below.';

export const ENGAGEMENT_SINCE_TILE_DESCRIPTION =
  'Track growth since you joined — Top, Rising, and Falling posts';

export const GROWTH_CONTRIBUTION_TOOLTIP =
  "Each percentage is that post's share of growth this period (reactions + comments + impressions + followers).";

export const GROWTH_CONTRIBUTION_BADGE_SUBLABEL = 'Share of growth';

export const GROWTH_DRIVERS_CONTRIBUTION_HINT =
  'Share of growth = how much of your total positive change came from this post (including followers from posts).';

export const METRIC_LABELS = {
  reactions: 'Reactions',
  comments: 'Comments',
  impressions: 'Impressions',
  engagementRate: 'Engagement rate',
  followersFromPosts: 'Followers from posts',
  clicks: 'Clicks',
  reposts: 'Reposts',
} as const;

export const METRIC_TOOLTIPS = {
  engagementRate: 'How often people who saw your post reacted, commented, reposted, or clicked.',
  followersFromPosts: 'New followers attributed to these posts in the selected time range.',
  clicks: 'Clicks on your post or links (when LinkedIn provides them).',
  reposts: 'Times people shared your post.',
  unavailable: 'This detail will appear when enough history is available for the selected range.',
} as const;

export const EMPTY_COPY = {
  notConnectedTitle: 'LinkedIn not connected',
  notConnectedDescription: 'Connect your LinkedIn account first to see how your posts are growing.',
  noDataTitle: 'No growth history yet',
  noDataDescription:
    'Sync your LinkedIn posts at least twice (ideally a day apart) so we can compare how they grew.',
  insufficientTitle: 'Not enough history to compare',
  insufficientDescription:
    'Sync again after your post numbers change, or pick a shorter time range once more history exists.',
  noChangesTitle: 'Numbers look steady',
  noChangesDescription:
    'No big changes in this comparison yet. Check Top for your strongest posts, or sync again later.',
  loadErrorTitle: 'Could not load growth',
  loadErrorFallback: 'Could not load engagement growth. Please try again.',
  loading: 'Loading your post growth…',
  syncButton: 'Sync Latest & Recompute',
  syncCooldownPrefix: 'Last updated recently — wait a bit before syncing again',
  retry: 'Retry',
} as const;

/** Plain-language messages for API baseline_reason codes (Phase 2+). */
export const BASELINE_REASON_COPY: Record<string, string> = {
  no_snapshots: 'We do not have saved snapshots yet. Sync your posts to start tracking growth.',
  insufficient_history:
    'We need an earlier snapshot for this time range. Sync again later or pick a shorter range.',
  baseline_too_close:
    'Your last syncs are too close together to compare. Wait a few hours (or a day), then sync again.',
  no_current_posts: 'No saved posts yet. Sync your LinkedIn posts to load growth.',
};

export const TAB_COPY = {
  top: { label: 'Top', hint: 'Strongest posts right now' },
  rising: { label: 'Rising', hint: 'Biggest gains this period' },
  falling: { label: 'Falling', hint: 'Biggest drops this period' },
} as const;

export const PERIOD_CHIP_LABELS = {
  '1d': '1 day',
  '7d': '7 days',
  '15d': '15 days',
  '30d': '1 month',
  since_joining: 'Since joining ALwrity',
} as const;
