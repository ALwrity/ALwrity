/**
 * Session cache for Comment Assistant drafts (mirrors usePostAnalytics sessionStorage).
 * Instant re-open of composer without a network round-trip within TTL.
 */

const CACHE_KEY = "alwrity_comment_assistant_drafts";
/** Align with backend draft TTL (24h). */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface DraftCacheEntry {
  reply: string;
  fetchedAt: number;
}

type DraftCacheMap = Record<string, DraftCacheEntry>;

function readMap(): DraftCacheMap {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftCacheMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: DraftCacheMap): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/** Return cached draft text when present and within TTL. */
export function getSessionDraft(commentId: string): string | null {
  if (!commentId) return null;
  const map = readMap();
  const entry = map[commentId];
  if (!entry?.reply) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    delete map[commentId];
    writeMap(map);
    return null;
  }
  return entry.reply;
}

/** Store a draft for instant reopen within the same browser session. */
export function setSessionDraft(commentId: string, reply: string): void {
  if (!commentId || !reply.trim()) return;
  const map = readMap();
  map[commentId] = { reply: reply.trim(), fetchedAt: Date.now() };
  writeMap(map);
}

/** Clear one comment's session draft (after successful reply or Regenerate). */
export function clearSessionDraft(commentId: string): void {
  if (!commentId) return;
  const map = readMap();
  if (!(commentId in map)) return;
  delete map[commentId];
  writeMap(map);
}
