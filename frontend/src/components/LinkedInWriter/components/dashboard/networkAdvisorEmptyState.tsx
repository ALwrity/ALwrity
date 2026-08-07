import React from "react";
import { colors } from "../GrowthEngine/styles";
import { GrowNetworkCrossLink } from "./GrowNetworkCrossLink";
import {
  EngagementConnectPrompt,
  EngagementEmptyPrompt,
} from "./engagementWedgeSharedUi";
import { GROW_NETWORK_CROSS_LINKS } from "./growNetworkConstants";

export interface NetworkAdvisorEmptyStateProps {
  hasAttemptedFetch: boolean;
  connected: boolean;
  dataSourceSummary: string;
  loading: boolean;
  onLoad: () => void;
  /** When true, show cross-link to Live LinkedIn section (P3). */
  showCrossLink?: boolean;
}

export const NetworkAdvisorEmptyState: React.FC<NetworkAdvisorEmptyStateProps> = ({
  hasAttemptedFetch,
  connected,
  dataSourceSummary,
  loading,
  onLoad,
  showCrossLink = false,
}) => {
  if (!connected) {
    return (
      <EngagementConnectPrompt message="Connect your LinkedIn account to get personalised network suggestions based on your profile and activity." />
    );
  }

  if (!hasAttemptedFetch && !loading) {
    return (
      <>
        <EngagementEmptyPrompt
          icon="🤝"
          title="Ready to discover connections"
          desc="Click Load Suggestions above to find people to connect with — grounded in your profile and industry research."
          btnLabel="🚀 Load Suggestions"
          onLoad={onLoad}
          loading={loading}
        />
        {showCrossLink && (
          <GrowNetworkCrossLink
            targetSection={GROW_NETWORK_CROSS_LINKS.aiToLinkedIn.target}
            message={GROW_NETWORK_CROSS_LINKS.aiToLinkedIn.message}
            linkLabel={GROW_NETWORK_CROSS_LINKS.aiToLinkedIn.linkLabel}
          />
        )}
      </>
    );
  }

  if (loading) return null;

  const summary =
    dataSourceSummary ||
    "No grounded connection suggestions yet. Suggestions only appear when LinkedIn profile data and industry research provide verifiable people to connect with.";

  return (
    <div
      style={{ textAlign: "center", padding: "16px 0 8px" }}
      data-testid="network-advisor-empty-state"
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>🤝</div>
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: colors.textDark,
          marginBottom: 8,
        }}
      >
        No connection suggestions available
      </div>
      <div
        style={{
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.55,
          maxWidth: 420,
          margin: "0 auto 12px",
        }}
      >
        {summary}
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={onLoad}
        data-testid="network-advisor-retry-btn"
        style={{
          padding: "10px 24px",
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        ↻ Try Again
      </button>
      {showCrossLink && (
        <GrowNetworkCrossLink
          targetSection={GROW_NETWORK_CROSS_LINKS.aiToLinkedIn.target}
          message={GROW_NETWORK_CROSS_LINKS.aiToLinkedIn.message}
          linkLabel={GROW_NETWORK_CROSS_LINKS.aiToLinkedIn.linkLabel}
        />
      )}
    </div>
  );
};
