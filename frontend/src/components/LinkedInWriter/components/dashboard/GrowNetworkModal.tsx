/**
 * Unified Grow Network — Network Advisor + Live LinkedIn PYMK.
 */
import React, { useEffect } from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { GrowNetworkLayout } from "./GrowNetworkLayout";
import {
  GrowNetworkNavProvider,
  scrollToGrowNetworkSection,
} from "./growNetworkNavContext";
import {
  GROW_NETWORK_MODAL_TITLE,
  type GrowNetworkScrollTarget,
} from "./growNetworkConstants";
import { GROW_NETWORK_MODAL_SIZE } from "./growNetworkModalLayout";

export type { GrowNetworkScrollTarget };

export interface GrowNetworkModalProps {
  open: boolean;
  onClose: () => void;
  connected?: boolean;
  scrollToSection?: GrowNetworkScrollTarget;
}

export const GrowNetworkModal: React.FC<GrowNetworkModalProps> = ({
  open,
  onClose,
  connected = true,
  scrollToSection,
}) => {
  useEffect(() => {
    if (!open || !scrollToSection) return;
    const timer = window.setTimeout(() => {
      scrollToGrowNetworkSection(scrollToSection);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open, scrollToSection]);

  return (
    <DashboardActionModal
      open={open}
      title={GROW_NETWORK_MODAL_TITLE}
      onClose={onClose}
      titleSize="xl"
      modalClassName="linkedin-grow-network-wedge-modal"
      width={GROW_NETWORK_MODAL_SIZE.width}
      maxWidth={GROW_NETWORK_MODAL_SIZE.maxWidth}
      height={GROW_NETWORK_MODAL_SIZE.height}
      maxHeight={GROW_NETWORK_MODAL_SIZE.maxHeight}
    >
      <GrowNetworkNavProvider>
        <GrowNetworkLayout
          open={open}
          connected={connected}
          onClose={onClose}
        />
      </GrowNetworkNavProvider>
    </DashboardActionModal>
  );
};
