import React from "react";
import { DashboardActionModal } from "./DashboardActionModal";
import { GrowthEnginePanel } from "../GrowthEngine/GrowthEnginePanel";
import { type LinkedInPreferences } from "../../utils/storageUtils";
import {
  WEDGE_BACK_LABELS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "./wedgeModalUi";
import { POST_WEDGE_MODAL_SIZE } from "./wedgeModalLayout";

interface GrowthEngineModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  /** When set with onBack, uses Engagement wedge drill-down header (back above title). */
  engagementWedgeNav?: boolean;
  generatePost: (
    params?: Record<string, unknown>,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  userPreferences: LinkedInPreferences;
}

export const GrowthEngineModal: React.FC<GrowthEngineModalProps> = ({
  open,
  onClose,
  onBack,
  engagementWedgeNav = false,
  generatePost,
  userPreferences,
}) => {
  const wedgeNav = engagementWedgeNav && Boolean(onBack);

  return (
    <DashboardActionModal
      open={open}
      title="Growth Engine"
      onClose={onClose}
      onBack={onBack}
      {...(wedgeNav
        ? wedgePostSizeSubModalProps(WEDGE_BACK_LABELS.engagement)
        : POST_WEDGE_MODAL_SIZE)}
      titleSize="xl"
      modalClassName={wedgePostSizeModalClassName()}
    >
      <GrowthEnginePanel
        open={open}
        embedded
        onClose={onClose}
        generatePost={generatePost}
        userPreferences={userPreferences}
      />
    </DashboardActionModal>
  );
};
