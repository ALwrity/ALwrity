import React from 'react';

import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { useLinkedInStudioProfileStrength } from '../../hooks/useLinkedInStudioProfileStrength';
import { OptimiseProfileControl } from './OptimiseProfileControl';
import { ResumeDraftRailChip } from './ResumeDraftRailChip';
import { TodayGrowthWalkthrough } from './TodayGrowthWalkthrough';

interface MobileStudioQuickActionsDockProps {
  dashboardDraft: string;
  onResumeDraft?: () => void;
  onClearDraft?: () => void;
  showPreferencesModal: boolean;
  onTogglePreferences: () => void;
}

/**
 * Mobile (≤960px): four studio actions in one segmented row above the workflow title.
 */
export const MobileStudioQuickActionsDock: React.FC<MobileStudioQuickActionsDockProps> = ({
  dashboardDraft,
  onResumeDraft,
  onClearDraft,
  showPreferencesModal,
  onTogglePreferences,
}) => {
  const { connected } = useLinkedInSocialConnection();
  const {
    profileStrengthPercent,
    profileStrengthLoading,
    strengthLabel,
    strengthTooltip,
  } = useLinkedInStudioProfileStrength();

  const handleOpenOptimiseProfile = () => {
    if (!connected) return;
    window.dispatchEvent(new CustomEvent('linkedinwriter:openOptimiseProfile'));
  };

  return (
    <div
      className="linkedin-writer-header-studio-dock"
      role="tablist"
      aria-label="Studio quick actions"
      data-tour="li-mobile-studio-actions"
    >
      <TodayGrowthWalkthrough variant="tab" />
      <ResumeDraftRailChip
        variant="tab"
        draft={dashboardDraft}
        onResumeDraft={onResumeDraft}
        onClear={onClearDraft}
      />
      <button
        type="button"
        className={`linkedin-writer-header-studio-tab linkedin-writer-header-studio-tab--persona${
          showPreferencesModal ? ' linkedin-writer-header-studio-tab--active' : ''
        }`}
        title="Content Persona — Set your writing voice"
        aria-expanded={showPreferencesModal}
        aria-haspopup="dialog"
        role="tab"
        onClick={onTogglePreferences}
      >
        <span className="linkedin-writer-header-studio-tab-label linkedin-writer-header-studio-tab-label--stacked">
          <span>Content</span>
          <span>Persona</span>
        </span>
        <span className="linkedin-writer-header-studio-tab-icon" aria-hidden>
          ⚙️
        </span>
      </button>
      <OptimiseProfileControl
        variant="tab"
        onOptimiseProfile={handleOpenOptimiseProfile}
        profileStrengthPercent={connected ? profileStrengthPercent : null}
        strengthLabel={strengthLabel}
        strengthTooltip={
          connected ? strengthTooltip : 'Connect LinkedIn to optimise your profile'
        }
        isLoading={profileStrengthLoading}
        isDisabled={!connected}
      />
    </div>
  );
};
