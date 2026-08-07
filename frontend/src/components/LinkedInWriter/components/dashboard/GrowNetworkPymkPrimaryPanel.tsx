/**
 * Right primary panel — active People You May Know (Plan wedge brainstorm pattern).
 */
import React from "react";
import ComponentErrorBoundary from "../../../../components/shared/ComponentErrorBoundary";
import { PymkNetworkSection } from "./PymkNetworkSection";
import {
  GROW_NETWORK_PYMK_SECTION,
} from "./growNetworkConstants";

export interface GrowNetworkPymkPrimaryPanelProps {
  open: boolean;
  onClose: () => void;
}

export const GrowNetworkPymkPrimaryPanel: React.FC<
  GrowNetworkPymkPrimaryPanelProps
> = ({ open, onClose }) => (
  <section
    id="live-linkedin"
    className="grow-network-wedge-primary"
    aria-label={GROW_NETWORK_PYMK_SECTION.title}
    data-testid="grow-network-section-live-linkedin"
  >
    <header className="grow-network-wedge-primary__header">
      <span className="grow-network-wedge-primary__icon-wrap" aria-hidden>
        <span className="grow-network-wedge-primary__icon">👥</span>
      </span>
      <div className="grow-network-wedge-primary__titles">
        <h3 className="grow-network-wedge-primary__title">
          {GROW_NETWORK_PYMK_SECTION.title}
        </h3>
        <p className="grow-network-wedge-primary__subtitle">
          {GROW_NETWORK_PYMK_SECTION.sourceDetail}
        </p>
      </div>
      <span className="grow-network-wedge-primary__badge">
        {GROW_NETWORK_PYMK_SECTION.sourceLabel}
      </span>
    </header>

    <div className="grow-network-wedge-primary__body">
      <ComponentErrorBoundary componentName="PymkNetworkSection">
        <PymkNetworkSection
          active={open}
          variant="embedded"
          embeddedInGrowNetwork
          onClose={onClose}
        />
      </ComponentErrorBoundary>
    </div>
  </section>
);
