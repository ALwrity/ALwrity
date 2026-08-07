/**
 * Right sidebar — Network Advisor (Plan wedge sidebar pattern).
 */
import React from "react";
import ComponentErrorBoundary from "../../../../components/shared/ComponentErrorBoundary";
import { NetworkAdvisorSection } from "./NetworkAdvisorSection";
import { NetworkAdvisorLockedPanel } from "./NetworkAdvisorLockedPanel";
import { isNetworkAdvisorLocked } from "../../utils/growNetworkLockedUi";
import { GROW_NETWORK_AI_SECTION } from "./growNetworkConstants";

export interface GrowNetworkLockedSidebarProps {
  open: boolean;
  connected: boolean;
  onClose: () => void;
}

export const GrowNetworkLockedSidebar: React.FC<GrowNetworkLockedSidebarProps> = ({
  open,
  connected,
  onClose,
}) => {
  const locked = isNetworkAdvisorLocked();

  return (
    <aside
      id="ai-advisor"
      className="grow-network-wedge-sidebar"
      aria-label="Network advisor tools"
      data-testid="grow-network-section-ai-advisor"
    >
      <p className="grow-network-wedge-sidebar__label">
        {GROW_NETWORK_AI_SECTION.title}
      </p>
      <div className="grow-network-wedge-sidebar__stack">
        {locked ? (
          <NetworkAdvisorLockedPanel />
        ) : (
          <ComponentErrorBoundary componentName="NetworkAdvisorSection">
            <NetworkAdvisorSection
              active={open}
              connected={connected}
              onClose={onClose}
              embeddedInGrowNetwork
            />
          </ComponentErrorBoundary>
        )}
      </div>
    </aside>
  );
};
