/**
 * Standalone Network Advisor modal (backward-compatible export).
 */
import React from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { POST_WEDGE_MODAL_SIZE, POST_WEDGE_MODAL_SIZE_CLASS } from "./wedgeModalLayout";
import { colors } from "../GrowthEngine/styles";
import { NetworkAdvisorSection } from "./NetworkAdvisorSection";

export interface NetworkAdvisorModalProps {
  open: boolean;
  onClose: () => void;
  connected?: boolean;
}

export const NetworkAdvisorModal: React.FC<NetworkAdvisorModalProps> = ({
  open,
  onClose,
  connected = true,
}) => (
  <DashboardActionModal
    open={open}
    title="Network Advisor"
    onClose={onClose}
    {...POST_WEDGE_MODAL_SIZE}
    modalClassName={POST_WEDGE_MODAL_SIZE_CLASS}
  >
    <p
      style={{
        margin: "0 0 14px",
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 1.5,
      }}
    >
      AI-suggested connections to grow your network this week — with
      personalised outreach messages grounded in your profile and industry
      research.
    </p>
    <NetworkAdvisorSection
      active={open}
      connected={connected}
      onClose={onClose}
    />
  </DashboardActionModal>
);
