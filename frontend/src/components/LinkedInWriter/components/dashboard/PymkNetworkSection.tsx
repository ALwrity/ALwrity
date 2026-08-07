/**
 * PYMK panel — embeddable in Grow Network or standalone modal.
 */
import React, { useCallback, useEffect } from "react";
import { usePeopleYouMayKnow } from "../../hooks/usePeopleYouMayKnow";
import { PymkCohortToolbar } from "../PeopleYouMayKnow/PymkCohortToolbar";
import { PymkCohortIdField } from "../PeopleYouMayKnow/PymkCohortFilter";
import { PymkPersonCard } from "../PeopleYouMayKnow/PymkPersonCard";
import { PYMK_COHORT_OPTIONS } from "../../../../services/linkedInPymkApi";
import {
  cardBase,
  colors,
  headerRow,
  secondaryBtn,
} from "../GrowthEngine/styles";
import { useOutreachDrafts } from "./useOutreachDrafts";
import { buildPymkOutreachInput } from "./networkOutreachDraft";
import { EngagementErrorBanner } from "./engagementWedgeSharedUi";
import { PymkNetworkEmptyState } from "./pymkNetworkEmptyState";

export interface PymkNetworkSectionProps {
  active?: boolean;
  variant?: "standalone" | "embedded";
  embeddedInGrowNetwork?: boolean;
  onClose?: () => void;
}

export const PymkNetworkSection: React.FC<PymkNetworkSectionProps> = ({
  active = true,
  variant = "embedded",
  embeddedInGrowNetwork = false,
  onClose,
}) => {
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

  const { drafts, draftingKey, draftError, draftForKey } =
    useOutreachDrafts(active);

  const enableOutreach = variant === "embedded" || variant === "standalone";

  useEffect(() => {
    if (!active) return;
    void fetchSuggestions({ pageStart: 0 }).catch(() => undefined);
  }, [active, cohort, fetchSuggestions]);

  useEffect(() => {
    if (!active) return;
    const needsId = PYMK_COHORT_OPTIONS.find((option) => option.id === cohort)
      ?.needsId;
    if (!needsId) return;

    const timer = window.setTimeout(() => {
      void fetchSuggestions({ pageStart: 0 }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [active, cohort, cohortId, fetchSuggestions]);

  const handleCohortChange = useCallback(
    (next: typeof cohort) => setCohort(next),
    [setCohort],
  );

  const handleRefresh = useCallback(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const suggestions = data?.suggestions ?? [];
  const showEmpty = !loading && !error && suggestions.length === 0;
  const isStandalone = variant === "standalone";

  const body = (
    <>
      {isStandalone && (
        <div style={headerRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }} aria-hidden="true">
              👥
            </span>
            <div>
              <div
                style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}
              >
                People You May Know
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                Live suggestions from your LinkedIn network
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: isStandalone ? 14 : 0 }}>
        <PymkCohortToolbar
          cohort={cohort}
          loading={loading}
          onCohortChange={handleCohortChange}
          onRefresh={handleRefresh}
        />
        <PymkCohortIdField
          cohort={cohort}
          cohortId={cohortId}
          cohortDefaults={cohortDefaults}
          onCohortIdChange={setCohortId}
        />
      </div>

      {error && <EngagementErrorBanner msg={error} />}
      {draftError && <EngagementErrorBanner msg={draftError} />}

      {loading && suggestions.length === 0 && (
        <div style={{ marginTop: 16, fontSize: 13, color: colors.textMuted }}>
          Fetching People You May Know from LinkedIn…
        </div>
      )}

      {showEmpty && (
        <PymkNetworkEmptyState showCrossLink={embeddedInGrowNetwork} />
      )}

      {suggestions.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          {suggestions.map((person) => {
            const key = person.profile_id;
            return (
              <PymkPersonCard
                key={key}
                person={person}
                enableOutreach={enableOutreach}
                draftText={drafts[key]}
                isDrafting={draftingKey === key}
                onDraftOutreach={() => {
                  void draftForKey(key, buildPymkOutreachInput(person));
                }}
                onClose={onClose}
              />
            );
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void loadMore().catch(() => undefined)}
            style={secondaryBtn}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading more…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );

  if (isStandalone) {
    return <div style={cardBase}>{body}</div>;
  }

  return <div data-testid="pymk-network-section">{body}</div>;
};
