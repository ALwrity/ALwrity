/**
 * Grow Network modal body — Plan wedge two-column layout.
 * Active PYMK (left 85%) · Network Advisor sidebar (right 15%).
 */
import React from "react";
import { GrowNetworkLockedSidebar } from "./GrowNetworkLockedSidebar";
import { GrowNetworkPymkPrimaryPanel } from "./GrowNetworkPymkPrimaryPanel";
import { GROW_NETWORK_INTRO } from "./growNetworkConstants";

export interface GrowNetworkLayoutProps {
  open: boolean;
  connected: boolean;
  onClose: () => void;
}

export const GrowNetworkLayout: React.FC<GrowNetworkLayoutProps> = ({
  open,
  connected,
  onClose,
}) => (
  <div className="grow-network-wedge">
    <p className="grow-network-wedge-intro">{GROW_NETWORK_INTRO}</p>
    <div className="grow-network-wedge-main">
      <GrowNetworkPymkPrimaryPanel open={open} onClose={onClose} />
      <GrowNetworkLockedSidebar
        open={open}
        connected={connected}
        onClose={onClose}
      />
    </div>
  </div>
);
