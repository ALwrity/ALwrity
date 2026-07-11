/**
 * Backward-compatible re-exports for Engagement Trends time helpers.
 * Prefer engagementTrendsLocaleFormat.ts for locale-aware formatting.
 */
import { formatLocalizedSnapshotLabel } from './engagementTrendsLocaleFormat';

export {
  parseUtcIso,
  formatLocalizedRelativeTime as formatTimeAgo,
  formatLocalizedDateTime as formatAbsoluteLocal,
  formatLocalizedSnapshotLabel,
  hasInsufficientSnapshots,
} from './engagementTrendsLocaleFormat';

/** @deprecated Use formatLocalizedSnapshotLabel().display */
export function formatSnapshotMoment(iso: string): string {
  return formatLocalizedSnapshotLabel(iso).display;
}
