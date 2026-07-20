import React from 'react';

import { OptimiseProfileRailChip } from './OptimiseProfileRailChip';
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
 * Mobile (≤960px): studio actions in one segmented row above the workflow title.
 */
export const MobileStudioQuickActionsDock: React.FC<MobileStudioQuickActionsDockProps> = ({
  dashboardDraft,
  onResumeDraft,
  onClearDraft,
  showPreferencesModal,
  onTogglePreferences,
}) => {
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
      <OptimiseProfileRailChip variant="tab" />
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
    </div>
  );
};
