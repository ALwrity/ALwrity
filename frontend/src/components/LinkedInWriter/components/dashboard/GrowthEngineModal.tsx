import React from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import { GrowthEnginePanel } from '../GrowthEngine/GrowthEnginePanel';
import { type LinkedInPreferences } from '../../utils/storageUtils';

interface GrowthEngineModalProps {
  open: boolean;
  onClose: () => void;
  generatePost: (params?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  userPreferences: LinkedInPreferences;
}

export const GrowthEngineModal: React.FC<GrowthEngineModalProps> = ({
  open,
  onClose,
  generatePost,
  userPreferences,
}) => (
  <DashboardActionModal
    open={open}
    title="Growth Engine"
    onClose={onClose}
    maxWidth={900}
    maxHeight="min(92vh, 900px)"
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
