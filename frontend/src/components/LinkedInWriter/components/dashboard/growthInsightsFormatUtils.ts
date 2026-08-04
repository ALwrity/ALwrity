/** Shared formatting helpers for growth insight timestamps in dashboard modals. */

export function formatInsightAge(cachedAt: number): string {
  const ms = Date.now() - cachedAt;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function formatInsightGeneratedAt(iso: string | undefined | null): string | null {
  if (!iso) return null;
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function buildInsightRefreshLabel(
  cachedAt: number,
  generatedAt?: string | null,
  fallbackLabel = "Last refreshed",
): string {
  const generatedLabel = formatInsightGeneratedAt(generatedAt);
  if (generatedLabel) {
    return `Insights generated on ${generatedLabel} · loaded ${formatInsightAge(cachedAt)}`;
  }
  return `${fallbackLabel} ${formatInsightAge(cachedAt)}`;
}
