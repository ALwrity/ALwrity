import {
  SEO_TOOLS_HISTORY_KEY,
  LEGACY_SEO_TOOLS_HISTORY_KEY,
  MAX_RUNS_PER_TOOL,
  saveToolRun,
  loadToolHistory,
  toolHistoryFor,
  clearToolHistory,
  type ToolRunRecord,
} from '../components/SeoToolsPanel/seoToolsHistory';

// Phase T3 — run history persistence. Versioned key (seo-tools-history:v1),
// latest-first, capped per tool, corrupt payloads never crash the reader, and
// legacy unversioned keys are never read or merged (cf. Phase 5 cache scheme).
const metaRecord = (overrides: Partial<ToolRunRecord> = {}): ToolRunRecord =>
  saveToolRun({
    toolId: 'meta',
    toolTitle: 'Meta Descriptions',
    siteUrl: 'https://example.com',
    status: 'success',
    result: { meta_descriptions: [{ text: 'x' }] },
    ...overrides,
  });

describe('Phase T3 — seo-tools run history (versioned storage)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves a run and reads it back (round-trip)', () => {
    const saved = saveToolRun({
      toolId: 'meta',
      toolTitle: 'Meta Descriptions',
      siteUrl: 'https://example.com',
      status: 'success',
      result: { ok: true },
    });

    expect(saved.id).toBeTruthy();
    expect(saved.ranAt).toBeTruthy();
    expect(typeof saved.ranAt).toBe('string');

    const all = loadToolHistory();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      toolId: 'meta',
      toolTitle: 'Meta Descriptions',
      status: 'success',
      result: { ok: true },
    });
  });

  it('orders newest first and persists across calls', () => {
    metaRecord();
    metaRecord();

    const all = loadToolHistory();
    expect(all).toHaveLength(2);
    expect(new Date(all[0].ranAt).getTime()).toBeGreaterThanOrEqual(
      new Date(all[1].ranAt).getTime(),
    );
  });

  it('caps per-tool history to the latest MAX_RUNS_PER_TOOL entries', () => {
    const stored = [] as ToolRunRecord[];
    for (let i = 0; i < MAX_RUNS_PER_TOOL + 2; i += 1) {
      stored.push(metaRecord());
    }

    const all = loadToolHistory();
    expect(all).toHaveLength(MAX_RUNS_PER_TOOL);
    // The two oldest are the ones dropped. Compare by unique id — ranAt is
    // millisecond-precision and can collide across rapid saves.
    for (const dropped of stored.slice(0, 2)) {
      expect(all.some((r) => r.id === dropped.id)).toBe(false);
    }
    for (const kept of stored.slice(2)) {
      expect(all.some((r) => r.id === kept.id)).toBe(true);
    }
  });

  it('keeps different tools independent under clear-by-tool', () => {
    metaRecord();
    saveToolRun({
      toolId: 'on-page',
      toolTitle: 'On-Page',
      status: 'error',
      error: 'Backend unavailable',
    });

    clearToolHistory('meta');

    expect(toolHistoryFor('meta')).toHaveLength(0);
    const remaining = toolHistoryFor('on-page');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].status).toBe('error');
    expect(remaining[0].error).toBe('Backend unavailable');
  });

  it('returns an empty list and drops the key on corrupt payloads (no crash)', () => {
    localStorage.setItem(SEO_TOOLS_HISTORY_KEY, 'not-json{');
    expect(loadToolHistory()).toEqual([]);
    expect(localStorage.getItem(SEO_TOOLS_HISTORY_KEY)).toBeNull();

    localStorage.setItem(SEO_TOOLS_HISTORY_KEY, JSON.stringify({ not: 'an array' }));
    expect(loadToolHistory()).toEqual([]);
  });

  it('filters out malformed records instead of letting them poison the store', () => {
    localStorage.setItem(
      SEO_TOOLS_HISTORY_KEY,
      JSON.stringify([
        { id: 'a', toolId: 'meta', ranAt: new Date().toISOString(), status: 'success' },
        { id: 'b', toolId: 42, ranAt: 'nope', status: 'weird' },
        { broken: true },
      ]),
    );

    const all = loadToolHistory();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('a');
  });

  it('ignores legacy unversioned keys entirely (never read, never merged, untouched)', () => {
    // A pure payload, NOT metaRecord(): that helper persists to the versioned
    // key as a side effect and would falsify the "versioned store is empty"
    // assertion.
    const legacyPayload = [
      {
        id: 'legacy-1',
        toolId: 'meta',
        toolTitle: 'Legacy',
        ranAt: new Date(2020, 0, 1).toISOString(),
        status: 'success',
        result: { legacy: true },
      },
    ];
    localStorage.setItem(LEGACY_SEO_TOOLS_HISTORY_KEY, JSON.stringify(legacyPayload));

    expect(loadToolHistory()).toEqual([]);
    // We must not delete or mutate a legacy key we do not own.
    expect(localStorage.getItem(LEGACY_SEO_TOOLS_HISTORY_KEY)).not.toBeNull();
  });
});