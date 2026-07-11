import React, { useCallback, useEffect, useRef } from 'react';
import { usePeopleYouMayKnow } from '../../hooks/usePeopleYouMayKnow';
import { PymkCohortFilter } from './PymkCohortFilter';
import { PymkPersonCard } from './PymkPersonCard';
import { EmptyState } from '../GrowthEngine/EmptyState';
import { cardBase, colors, headerRow, primaryBtn, secondaryBtn } from '../GrowthEngine/styles';

export const PeopleYouMayKnowPanel: React.FC = () => {
  const {
    data,
    loading,
    loadingMore,
    error,
    cohort,
    setCohort,
    cohortId,
    setCohortId,
    cohortDefaults,
    fetchSuggestions,
    loadMore,
    refresh,
  } = usePeopleYouMayKnow();

  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    void fetchSuggestions().catch(() => undefined);
  }, [fetchSuggestions]);

  const handleCohortChange = useCallback(
    (next: typeof cohort) => {
      setCohort(next);
    },
    [setCohort],
  );

  const handleLoad = useCallback(() => {
    void fetchSuggestions({ pageStart: 0 }).catch(() => undefined);
  }, [fetchSuggestions]);

  const handleRefresh = useCallback(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const suggestions = data?.suggestions ?? [];
  const showEmpty = !loading && !error && suggestions.length === 0;

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">👥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
              People You May Know
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              Live suggestions from your LinkedIn network
            </div>
          </div>
        </div>
        <button type="button" onClick={handleRefresh} style={secondaryBtn} disabled={loading}>
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <PymkCohortFilter
          cohort={cohort}
          cohortId={cohortId}
          cohortDefaults={cohortDefaults}
          onCohortChange={handleCohortChange}
          onCohortIdChange={setCohortId}
        />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleLoad} style={primaryBtn} disabled={loading}>
          {loading ? 'Loading…' : 'Load suggestions'}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading && suggestions.length === 0 && (
        <div style={{ marginTop: 16, fontSize: 13, color: colors.textMuted }}>
          Fetching People You May Know from LinkedIn…
        </div>
      )}

      {showEmpty && (
        <div style={{ marginTop: 16 }}>
          <EmptyState
            icon="🔍"
            message="No suggestions returned for this cohort. Try Recent activity or verify the cohort ID."
          />
        </div>
      )}

      {suggestions.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          {suggestions.map((person) => (
            <PymkPersonCard key={person.profile_id} person={person} />
          ))}
        </div>
      )}

      {/* Always show Load more when we have suggestions - backend may not always return correct has_more */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void loadMore().catch(() => undefined)}
            style={secondaryBtn}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading more…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};
