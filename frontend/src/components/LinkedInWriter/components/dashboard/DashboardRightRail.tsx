import React from 'react';
import { DashboardAnalyticsSidebar, DASHBOARD_RIGHT_RAIL_WIDTH } from './DashboardAnalyticsSidebar';
import { DashboardCopilotFab } from './DashboardCopilotFab';
import { KnowledgeCenterDock, type KnowledgeCenterAction } from './KnowledgeCenterDock';
import { FRAME_COLOR } from './dashboardWorkflowConfig';
import { LinkedInBestPracticesTip } from '../LinkedInBestPracticesTip';

interface DashboardRightRailProps {
  onViewAllAnalytics?: () => void;
  onOpenCopilot?: () => void;
  onKnowledgeCenterAction?: (action: KnowledgeCenterAction) => void;
}

/** Right rail: Analytics panel, Co-Pilot, Knowledge Center, and Best-Practice Tip. */
export const DashboardRightRail: React.FC<DashboardRightRailProps> = ({
  onViewAllAnalytics,
  onOpenCopilot,
  onKnowledgeCenterAction,
}) => (
  <aside className="linkedin-dashboard-right-rail" aria-label="Dashboard tools"
    style={{
      width: DASHBOARD_RIGHT_RAIL_WIDTH,
      minWidth: DASHBOARD_RIGHT_RAIL_WIDTH,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      background: FRAME_COLOR,
      borderRadius: 16,
      padding: 16,
      boxSizing: 'border-box',
    }}
  >
    <DashboardAnalyticsSidebar onViewAll={onViewAllAnalytics} />
    {onOpenCopilot && <DashboardCopilotFab onOpenCopilot={onOpenCopilot} variant="rail" layout="stacked" />}
    {onKnowledgeCenterAction && (
      <KnowledgeCenterDock onFeatureAction={onKnowledgeCenterAction} variant="rail" />
    )}
    {/* Issue #731 — LinkedIn best-practice contextual tip */}
    <LinkedInBestPracticesTip />
  </aside>
);
