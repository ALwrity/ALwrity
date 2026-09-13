/**
 * Guarded form parsers for SEO inputs (Phase 3D).
 * Fail fast on bad input: empty entries are dropped, out-of-range numbers
 * are clamped, and unparseable numbers fall back to explicit defaults —
 * never NaN, never [''].
 */

export const GSC_DATE_RANGE_MIN = 7;
export const GSC_DATE_RANGE_MAX = 365;
export const GSC_DATE_RANGE_DEFAULT = 90;

/** Split a comma-separated input, trimming entries and dropping empties. */
export function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** True only for absolute http(s) URLs. Trims surrounding whitespace first. */
export function isValidHttpUrl(raw: string): boolean {
  const value = (raw ?? '').trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Parse the GSC day range; NaN/out-of-range fall back to guarded values. */
export function parseDateRangeDays(raw: string): number {
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return GSC_DATE_RANGE_DEFAULT;
  return Math.min(
    GSC_DATE_RANGE_MAX,
    Math.max(GSC_DATE_RANGE_MIN, parsed),
  );
}
