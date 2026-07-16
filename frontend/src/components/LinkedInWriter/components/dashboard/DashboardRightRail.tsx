import React from 'react';
import { DashboardAnalyticsSidebar, DASHBOARD_RIGHT_RAIL_WIDTH } from './DashboardAnalyticsSidebar';
import { KnowledgeCenterDock, type KnowledgeCenterAction } from './KnowledgeCenterDock';
import { LibraryRailButton } from './LibraryRailButton';
import { ResumeDraftRailChip } from './ResumeDraftRailChip';

interface DashboardRightRailProps {
  onViewAllAnalytics?: () => void;
  onKnowledgeCenterAction?: (action: KnowledgeCenterAction) => void;
  /** Draft text to show a resume chip when a saved draft exists */
  draft?: string;
  /** Called when user clicks "Continue editing" on the resume chip popover */
  onResumeDraft?: () => void;
  /** Called when user clicks "Discard" on the resume chip popover */
  onClear?: () => void;
}

/** Right rail: Analytics panel and Knowledge Center as separate stacked blocks. */
export const DashboardRightRail: React.FC<DashboardRightRailProps> = ({
  onViewAllAnalytics,
  onKnowledgeCenterAction,
  draft,
  onResumeDraft,
  onClear,
}) => {
  return (
    <aside
      className="linkedin-dashboard-right-rail linkedin-dashboard-data-section"
      aria-label="Dashboard tools"
      data-tour="li-mobile-analytics"
      style={{
        width: DASHBOARD_RIGHT_RAIL_WIDTH,
        flexShrink: 0,
        alignSelf: 'stretch',
        background: 'transparent',
        padding: '10px 10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0,
        overflow: 'visible',
      }}
    >
      <h2 className="linkedin-dashboard-data-section-title">Analytics &amp; Knowledge</h2>

      <DashboardAnalyticsSidebar onViewAll={onViewAllAnalytics} />

      <div className="linkedin-dashboard-rail-actions">
        <LibraryRailButton />

        <ResumeDraftRailChip
          draft={draft ?? ''}
          onResumeDraft={onResumeDraft}
          onClear={onClear}
        />

        {onKnowledgeCenterAction && (
          <KnowledgeCenterDock variant="rail" onFeatureAction={onKnowledgeCenterAction} />
        )}
      </div>
    </aside>
  );
};
