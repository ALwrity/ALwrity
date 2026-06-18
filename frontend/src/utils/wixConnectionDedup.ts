const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes (covers full OAuth redirect round-trip)

/**
 * Generate a unique dedup key scoped to a specific Wix OAuth flow.
 * Uses the OAuth `state` parameter when available, otherwise a generic key.
 */
function dedupKey(state?: string): string {
  return state ? `wix_oauth_handled_${state}` : 'wix_oauth_handled';
}

export function markConnectionHandled(state?: string): void {
  try {
    sessionStorage.setItem(dedupKey(state), Date.now().toString());
  } catch {}
}

export function isAlreadyHandled(state?: string): boolean {
  try {
    const ts = sessionStorage.getItem(dedupKey(state));
    if (ts) {
      const elapsed = Date.now() - parseInt(ts, 10);
      if (elapsed < DEDUP_TTL_MS) return true;
      sessionStorage.removeItem(dedupKey(state));
    }
  } catch {}
  return false;
}

export function clearConnectionHandled(state?: string): void {
  try {
    sessionStorage.removeItem(dedupKey(state));
  } catch {}
}