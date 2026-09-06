/**
 * Stable identity for a Connect Platforms analysis session (URL + analysis version).
 * Used to scope research/persona/background caches to the current website analysis.
 */

export interface WebsiteAnalysisIdentity {
  id?: string | number;
  updated_at?: string;
}

export function normalizeOnboardingUrl(url: string): string {
  if (!url || !url.trim()) return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

function analysisToken(analysis: WebsiteAnalysisIdentity | null | undefined): string {
  if (!analysis) return '';
  if (analysis.id !== undefined && analysis.id !== null && String(analysis.id).trim() !== '') {
    return String(analysis.id);
  }
  if (analysis.updated_at) return analysis.updated_at;
  return '';
}

export function buildWebsiteSessionKey(
  websiteUrl: string,
  analysis?: WebsiteAnalysisIdentity | null
): string {
  const normalizedUrl = normalizeOnboardingUrl(websiteUrl);
  return `${normalizedUrl}:${analysisToken(analysis ?? null)}`;
}

export function isSameWebsiteSession(
  keyA: string | null | undefined,
  keyB: string | null | undefined
): boolean {
  if (!keyA || !keyB) return false;
  return keyA === keyB;
}

export function parseWebsiteSessionKey(key: string): {
  url: string;
  analysisToken: string;
} {
  const idx = key.indexOf(':');
  if (idx === -1) {
    return { url: key, analysisToken: '' };
  }
  return {
    url: key.slice(0, idx),
    analysisToken: key.slice(idx + 1),
  };
}
