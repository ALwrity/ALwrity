/**
 * Per-tool run history (Phase T3).
 *
 * Versioned key (seo-tools-history:v1, cf. the Phase 5 analysis cache scheme)
 * so the storage contract can migrate without guessing at old shapes. Legacy
 * unversioned keys are NEVER read or merged — this module only ever touches
 * the key it owns. History is display-only by design: `SeoToolCard` never
 * auto-executes a stored run on mount.
 *
 * Reads fail fast: corrupt JSON or malformed records are dropped (and a
 * corrupt store key is cleared) so one bad write can never crash the panel.
 */

export interface ToolRunRecord {
  id: string;
  toolId: string;
  toolTitle?: string;
  siteUrl?: string;
  ranAt: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
}

export type SaveToolRunInput = Omit<ToolRunRecord, 'id' | 'ranAt'> & { toolTitle: string };

export const SEO_TOOLS_HISTORY_KEY = 'seo-tools-history:v1';
export const LEGACY_SEO_TOOLS_HISTORY_KEY = 'seo-tools-history';
export const MAX_RUNS_PER_TOOL = 5;

const VALID_STATUSES = new Set(['success', 'error']);

/** Guarded shape check — a record is usable only if all critical fields hold. */
const isToolRunRecord = (value: unknown): value is ToolRunRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.toolId === 'string' &&
    typeof record.ranAt === 'string' &&
    typeof record.status === 'string' &&
    VALID_STATUSES.has(record.status)
  );
};

/** Read the versioned store; corrupt payloads yield [] and are cleared. */
export function loadToolHistory(): ToolRunRecord[] {
  try {
    const raw = localStorage.getItem(SEO_TOOLS_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      // Not the shape we wrote — never guess, treat as a miss and drop it.
      localStorage.removeItem(SEO_TOOLS_HISTORY_KEY);
      return [];
    }
    return parsed.filter(isToolRunRecord);
  } catch {
    localStorage.removeItem(SEO_TOOLS_HISTORY_KEY);
    return [];
  }
}

/** Runs for one tool, newest first. */
export function toolHistoryFor(toolId: string): ToolRunRecord[] {
  return loadToolHistory().filter((record) => record.toolId === toolId);
}

/** Prepend a run, trim per-tool to the latest MAX_RUNS_PER_TOOL, persist. */
export function saveToolRun(input: SaveToolRunInput): ToolRunRecord {
  const record: ToolRunRecord = {
    ...input,
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ranAt: new Date().toISOString(),
  };

  // History is already newest-first; keep this tool's latest MAX entries and
  // leave every other tool's list untouched.
  const mine = toolHistoryFor(input.toolId);
  const others = loadToolHistory().filter((existing) => existing.toolId !== input.toolId);
  const trimmed = [...[record, ...mine].slice(0, MAX_RUNS_PER_TOOL), ...others];

  try {
    localStorage.setItem(SEO_TOOLS_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full/unavailable — the in-memory record still returns; the panel
    // simply won't persist this run rather than crash a successful request.
  }
  return record;
}

/** Remove history for one tool (or every tool when none is given). */
export function clearToolHistory(toolId?: string): void {
  const remaining = toolId
    ? loadToolHistory().filter((record) => record.toolId !== toolId)
    : [];
  if (remaining.length === 0) {
    localStorage.removeItem(SEO_TOOLS_HISTORY_KEY);
    return;
  }
  localStorage.setItem(SEO_TOOLS_HISTORY_KEY, JSON.stringify(remaining));
}