/**
 * Network Advisor panel — embeddable in Grow Network or standalone modal.
 */
import React from "react";
import { colors } from "../GrowthEngine/styles";
import { isNetworkAdvisorLocked } from "../../utils/growNetworkLockedUi";
import { openGrowNetworkModal } from "../../utils/linkedInDashboardEvents";
import { useNetworkAdvisor } from "./useNetworkAdvisor";
import { useOutreachDrafts } from "./useOutreachDrafts";
import { buildAiSuggestionOutreachInput } from "./networkOutreachDraft";
import {
  EngagementErrorBanner,
  EngagementLoadingRow,
  EngagementStaleDataNote,
} from "./engagementWedgeSharedUi";
import { NetworkAdvisorEmptyState } from "./networkAdvisorEmptyState";
import { NetworkAdvisorSuggestionRow } from "./networkAdvisorSuggestionRow";
import { NetworkAdvisorToolbar } from "./networkAdvisorToolbar";
import {
  NETWORK_ADVISOR_ANTI_HALLUCINATION_NOTE,
  NETWORK_ADVISOR_LOADING_MSG,
} from "./networkAdvisorConstants";
import { NetworkAdvisorLockedPanel } from "./NetworkAdvisorLockedPanel";

export interface NetworkAdvisorSectionProps {
  active: boolean;
  connected?: boolean;
  onClose?: () => void;
  /** Enables cross-links to PYMK section inside Grow Network modal. */
  embeddedInGrowNetwork?: boolean;
}

export const NetworkAdvisorSection: React.FC<NetworkAdvisorSectionProps> = ({
  active,
  connected = true,
  onClose = () => {},
  embeddedInGrowNetwork = false,
}) => {
  const locked = isNetworkAdvisorLocked();
  const sectionActive = active && !locked;

  const {
    suggestions,
    dataSourceSummary,
    hasAttemptedFetch,
    loading,
    error,
    loadSuggestions,
  } = useNetworkAdvisor(sectionActive, { autoLoad: true, connected });

  const { drafts, draftingKey, draftError, draftForKey } =
    useOutreachDrafts(sectionActive);

  if (locked) {
    return <NetworkAdvisorLockedPanel />;
  }

  const handleLoad = () => {
    void loadSuggestions();
  };

  const showEmptyPanel = !loading && suggestions.length === 0;

  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: colors.textTertiary,
          background: colors.badgeBg,
          padding: "8px 10px",
          borderRadius: 8,
          marginBottom: 12,
          lineHeight: 1.45,
        }}
        data-testid="network-advisor-anti-hallucination-note"
      >
        {NETWORK_ADVISOR_ANTI_HALLUCINATION_NOTE}
      </div>

      {!connected && hasAttemptedFetch && <EngagementStaleDataNote />}

      <NetworkAdvisorToolbar
        connected={connected}
        loading={loading}
        suggestionCount={suggestions.length}
        onLoad={handleLoad}
      />

      {loading && (
        <EngagementLoadingRow message={NETWORK_ADVISOR_LOADING_MSG} />
      )}
      {error && <EngagementErrorBanner msg={error} />}
      {draftError && <EngagementErrorBanner msg={draftError} />}

      {showEmptyPanel && (
        <NetworkAdvisorEmptyState
          hasAttemptedFetch={hasAttemptedFetch}
          connected={connected}
          dataSourceSummary={dataSourceSummary}
          loading={loading}
          onLoad={handleLoad}
          showCrossLink={embeddedInGrowNetwork}
        />
      )}

      {!loading &&
        suggestions.slice(0, 3).map((item, idx) => {
          const key = `ai-${idx}-${item.name}`;
          return (
            <NetworkAdvisorSuggestionRow
              key={key}
              item={item}
              idx={idx}
              hasDraft={!!drafts[key]}
              isDrafting={draftingKey === key}
              draftText={drafts[key]}
              onDraftOutreach={() => {
                void draftForKey(key, buildAiSuggestionOutreachInput(item));
              }}
              onClose={onClose}
            />
          );
        })}

      {!loading && suggestions.length > 3 && (
        <div
          style={{
            fontSize: 12,
            color: colors.textTertiary,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          + {suggestions.length - 3} more in{" "}
          <button
            type="button"
            onClick={() => {
              openGrowNetworkModal({ scrollToSection: "ai-advisor" });
              onClose();
            }}
            style={{
              background: "none",
              border: "none",
              color: colors.primary,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
            }}
          >
            Grow Network →
          </button>
        </div>
      )}
    </>
  );
};
