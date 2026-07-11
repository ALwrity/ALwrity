import React from 'react';
import { DashboardAnalyticsSidebar, DASHBOARD_RIGHT_RAIL_WIDTH } from './DashboardAnalyticsSidebar';
import { KnowledgeCenterDock, type KnowledgeCenterAction } from './KnowledgeCenterDock';
import { LibraryRailButton } from './LibraryRailButton';

interface DashboardRightRailProps {
  onViewAllAnalytics?: () => void;
  onKnowledgeCenterAction?: (action: KnowledgeCenterAction) => void;
}

/** Right rail: Analytics panel and Knowledge Center as separate stacked blocks. */
export const DashboardRightRail: React.FC<DashboardRightRailProps> = ({
  onViewAllAnalytics,
  onKnowledgeCenterAction,
}) => {
  return (
    <aside
      className="linkedin-dashboard-right-rail"
      aria-label="Dashboard tools"
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
      <DashboardAnalyticsSidebar onViewAll={onViewAllAnalytics} />

      <div className="linkedin-dashboard-rail-actions">
        <LibraryRailButton />
        {onKnowledgeCenterAction && (
          <KnowledgeCenterDock variant="rail" onFeatureAction={onKnowledgeCenterAction} />
        )}
      </div>
    </aside>
  );
};
