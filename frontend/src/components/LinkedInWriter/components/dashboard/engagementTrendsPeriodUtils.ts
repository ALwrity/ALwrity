/**
 * Client-side period helpers for Engagement Since You Joined ALwrity (Phase 1).
 * Period selection is UI-only until Phase 3 wires `?period=` to the API.
 */

import type { PostAnalyticsHistoryResponse, PostDelta } from '../../../../services/postAnalyticsApi';
import { hasInsufficientSnapshots } from './engagementTrendsTimeUtils';

export type EngagementPeriodKey = '1d' | '7d' | '15d' | '30d' | 'since_joining';

export type EngagementPostTab = 'top' | 'rising' | 'falling';

export const ENGAGEMENT_PERIOD_KEYS: EngagementPeriodKey[] = [
  '1d',
  '7d',
  '15d',
  '30d',
  'since_joining',
];

/** Client-side sync cooldown so users are nudged not to hammer Sync (Phase 1). */
export const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

export function resolveDefaultPeriod(
  data: PostAnalyticsHistoryResponse | null,
): EngagementPeriodKey {
  if (!data || hasInsufficientSnapshots(data.period)) {
    return '1d';
  }
  // Enough history to compare → prefer full journey framing.
  return 'since_joining';
}

export function isSyncOnCooldown(
  lastSyncedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastSyncedAt) return false;
  const syncedMs = Date.parse(lastSyncedAt);
  if (Number.isNaN(syncedMs)) return false;
  return nowMs - syncedMs < SYNC_COOLDOWN_MS;
}

export function syncCooldownRemainingLabel(
  lastSyncedAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!lastSyncedAt || !isSyncOnCooldown(lastSyncedAt, nowMs)) return null;
  const syncedMs = Date.parse(lastSyncedAt);
  const remainingMs = SYNC_COOLDOWN_MS - (nowMs - syncedMs);
  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  return `about ${mins} min`;
}

function compositeDelta(post: PostDelta): number {
  return post.reactions_delta + post.comments_delta + post.impressions_delta;
}

/**
 * Phase 1 tab lists from existing API arrays (no new backend fields).
 * Prefer Phase 2 lists when present; else map gainers/decliners + client Top sort.
 */
export function postsForTab(
  tab: EngagementPostTab,
  data: PostAnalyticsHistoryResponse,
): PostDelta[] {
  if (tab === 'rising') {
    return data.rising_posts?.length ? data.rising_posts : data.top_gainers;
  }
  if (tab === 'falling') {
    return data.falling_posts?.length ? data.falling_posts : data.top_decliners;
  }
  if (data.top_posts?.length) {
    return data.top_posts;
  }

  const byId = new Map<string, PostDelta>();
  for (const post of [...data.top_gainers, ...data.top_decliners]) {
    byId.set(post.post_id, post);
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.engagement_rate_now - a.engagement_rate_now || compositeDelta(b) - compositeDelta(a),
  );
}

export function tabGainDirection(tab: EngagementPostTab): boolean {
  return tab !== 'falling';
}
