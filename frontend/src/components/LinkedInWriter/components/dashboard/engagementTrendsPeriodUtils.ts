/**
 * Period helpers for Engagement Since You Joined ALwrity (Phase 3 wired to API).
 */

import type { PostAnalyticsHistoryResponse, PostDelta } from '../../../../services/postAnalyticsApi';
import { BASELINE_REASON_COPY, EMPTY_COPY } from './engagementTrendsCopy';
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

/** Fallback Sync cooldown when API omits recommended_sync_cooldown_seconds. */
export const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

const INSUFFICIENT_REASONS = new Set([
  'no_snapshots',
  'insufficient_history',
  'baseline_too_close',
  'no_current_posts',
]);

export function isInsufficientHistory(data: PostAnalyticsHistoryResponse | null): boolean {
  if (!data) return true;
  if (data.baseline_reason && INSUFFICIENT_REASONS.has(data.baseline_reason)) {
    return true;
  }
  return (
    hasInsufficientSnapshots(data.period) &&
    data.summary.total_posts === 0 &&
    !(data.top_posts?.length || data.rising_posts?.length || data.falling_posts?.length)
  );
}

export function resolveDefaultPeriod(
  data: PostAnalyticsHistoryResponse | null,
): EngagementPeriodKey {
  if (isInsufficientHistory(data)) return '1d';
  return 'since_joining';
}

export function insufficientHistoryMessage(data: PostAnalyticsHistoryResponse | null): string {
  const reason = data?.baseline_reason;
  if (reason && BASELINE_REASON_COPY[reason]) return BASELINE_REASON_COPY[reason];
  return EMPTY_COPY.insufficientDescription;
}

export function resolveSyncCooldownMs(data: PostAnalyticsHistoryResponse | null): number {
  const seconds = data?.recommended_sync_cooldown_seconds;
  if (typeof seconds === 'number' && seconds > 0) return seconds * 1000;
  return SYNC_COOLDOWN_MS;
}

export function isSyncOnCooldown(
  lastSyncedAt: string | null | undefined,
  nowMs: number = Date.now(),
  cooldownMs: number = SYNC_COOLDOWN_MS,
): boolean {
  if (!lastSyncedAt) return false;
  const syncedMs = Date.parse(lastSyncedAt);
  if (Number.isNaN(syncedMs)) return false;
  return nowMs - syncedMs < cooldownMs;
}

export function syncCooldownRemainingLabel(
  lastSyncedAt: string | null | undefined,
  nowMs: number = Date.now(),
  cooldownMs: number = SYNC_COOLDOWN_MS,
): string | null {
  if (!lastSyncedAt || !isSyncOnCooldown(lastSyncedAt, nowMs, cooldownMs)) return null;
  const syncedMs = Date.parse(lastSyncedAt);
  const remainingMs = cooldownMs - (nowMs - syncedMs);
  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  return `about ${mins} min`;
}

function compositeDelta(post: PostDelta): number {
  return (
    post.reactions_delta +
    post.comments_delta +
    post.impressions_delta +
    (post.followers_delta ?? 0)
  );
}

/** Prefer Phase 2 Top / Rising / Falling arrays; fall back to legacy gainers/decliners. */
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
    (a, b) =>
      (b.impressions_now ?? 0) - (a.impressions_now ?? 0) ||
      (b.reactions_now ?? 0) - (a.reactions_now ?? 0) ||
      b.engagement_rate_now - a.engagement_rate_now ||
      compositeDelta(b) - compositeDelta(a),
  );
}
