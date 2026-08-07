import React from "react";
import { EmptyState } from "../GrowthEngine/EmptyState";
import { GrowNetworkCrossLink } from "./GrowNetworkCrossLink";
import { GROW_NETWORK_CROSS_LINKS } from "./growNetworkConstants";

export interface PymkNetworkEmptyStateProps {
  showCrossLink?: boolean;
}

export const PymkNetworkEmptyState: React.FC<PymkNetworkEmptyStateProps> = ({
  showCrossLink = false,
}) => (
  <div style={{ marginTop: 16 }} data-testid="pymk-network-empty-state">
    <EmptyState
      icon="🔍"
      message="No suggestions returned for this cohort. Try Recent activity or verify the cohort ID."
    />
    {showCrossLink && (
      <GrowNetworkCrossLink
        targetSection={GROW_NETWORK_CROSS_LINKS.linkedInToAi.target}
        message={GROW_NETWORK_CROSS_LINKS.linkedInToAi.message}
        linkLabel={GROW_NETWORK_CROSS_LINKS.linkedInToAi.linkLabel}
      />
    )}
  </div>
);
