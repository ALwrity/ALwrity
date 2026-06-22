export async function hashContent(text: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return String(h);
  }
}

export function getSeoCacheKey(contentHash: string, title?: string): string {
  return `seo_cache:${contentHash}:${title || ''}`;
}

/**
 * Modal-level cache key for the flow analysis progress modal.
 * Stores the per-API-call response so re-opening the modal avoids a fresh
 * LLM round-trip when the blog content and title haven't changed.
 */
export function getFlowCacheKey(contentHash: string, title?: string): string {
  return `flow_analysis_cache:${contentHash}:${title || ''}`;
}

/**
 * A short, deterministic fingerprint for blog content used to detect stale
 * flow-analysis / SEO-metadata results after a refresh. Unlike the modal
 * cache key, this fingerprint is synchronous and small so it can be compared
 * cheaply on every page load. It includes the actual section content
 * (hashed) so that editing a single section invalidates cached results.
 */
export function computeContentFingerprint(
  outlineIds: string[],
  selectedTitle: string,
  contentHashesById: Record<string, string>,
): string {
  // Use only outline IDs (sorted) so a section reorder doesn't invalidate
  // cached results. The per-section content hash is what detects edits.
  const ids = outlineIds.map(String).sort().join(',');
  const titlePart = (selectedTitle || '').replace(/\.\.\.$/, '');
  const contentPart = outlineIds
    .map(id => `${id}:${contentHashesById[String(id)] || ''}`)
    .join('|');
  return `${ids}|${titlePart}|${contentPart}`;
}

/** Cheap synchronous hash for a single section's content. */
export function hashSectionContent(text: string): string {
  if (!text) return '';
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return `s${(h >>> 0).toString(36)}`;
}
