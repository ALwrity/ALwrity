import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {
  KNOWLEDGE_CENTER_FEATURES,
  type KnowledgeCenterFeature,
} from './knowledgeCenterFeatures';
import { FRAME_COLOR } from './dashboardWorkflowConfig';
import type { KnowledgeCenterAction } from './KnowledgeCenterDock';
import { DashboardActionModal } from './DashboardActionModal';
import { STUDIO_TAB_ACTION_MODAL_CLASS } from './dashboardLayoutConstants';

interface DashboardMobileAnalyticsSectionProps {
  onViewAnalytics: () => void;
  onKnowledgeCenterAction: (action: KnowledgeCenterAction) => void;
}

interface MobileBottomIconActionProps {
  label: string;
  ariaLabel: string;
  ariaExpanded?: boolean;
  onClick: () => void;
  tourTarget?: string;
  children: React.ReactNode;
}

const MobileBottomIconAction: React.FC<MobileBottomIconActionProps> = ({
  label,
  ariaLabel,
  ariaExpanded,
  onClick,
  tourTarget,
  children,
}) => (
  <button
    type="button"
    className="linkedin-mobile-analytics-icon-btn"
    data-tour={tourTarget}
    onClick={onClick}
    aria-label={ariaLabel}
    aria-expanded={ariaExpanded}
    title={label}
  >
    <span className="linkedin-mobile-analytics-icon-btn-circle" aria-hidden>
      {children}
    </span>
    <span className="linkedin-mobile-analytics-icon-btn-label">{label}</span>
  </button>
);

/**
 * Mobile-only (≤960px) entry for Analytics, Knowledge Center & Library — M-17, M-18, M-19.
 * Three equal circular icon actions in one row; Knowledge opens a centered modal.
 */
export const DashboardMobileAnalyticsSection: React.FC<DashboardMobileAnalyticsSectionProps> = ({
  onViewAnalytics,
  onKnowledgeCenterAction,
}) => {
  const navigate = useNavigate();
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  const handleFeatureClick = (feature: KnowledgeCenterFeature) => {
    onKnowledgeCenterAction(feature.action);
    setKnowledgeOpen(false);
  };

  const openLibrary = () => {
    navigate('/asset-library?source_module=linkedin_writer');
  };

  return (
    <>
      <section
        className="linkedin-mobile-analytics-section"
        aria-label="Analytics, Knowledge Center, and Library"
        data-tour="li-mobile-analytics"
      >
        <div className="linkedin-mobile-analytics-actions">
          <MobileBottomIconAction
            label="Analytics"
            ariaLabel="View post analytics"
            onClick={onViewAnalytics}
            tourTarget="li-mobile-analytics-icon"
          >
            <AnalyticsIcon fontSize="medium" />
          </MobileBottomIconAction>

          <MobileBottomIconAction
            label="Knowledge center"
            ariaLabel="Knowledge center"
            ariaExpanded={knowledgeOpen}
            onClick={() => setKnowledgeOpen(true)}
            tourTarget="li-mobile-knowledge-icon"
          >
            <MenuBookIcon fontSize="medium" />
          </MobileBottomIconAction>

          <MobileBottomIconAction
            label="Library"
            ariaLabel="Open content library"
            onClick={openLibrary}
            tourTarget="li-mobile-library-icon"
          >
            <CollectionsBookmarkIcon fontSize="medium" />
          </MobileBottomIconAction>
        </div>
      </section>

      <DashboardActionModal
        open={knowledgeOpen}
        title="Knowledge Center"
        onClose={() => setKnowledgeOpen(false)}
        maxWidth={440}
        maxHeight="min(85dvh, 640px)"
        modalClassName={STUDIO_TAB_ACTION_MODAL_CLASS}
      >
        <div className="linkedin-knowledge-center-grid linkedin-mobile-analytics-knowledge-grid">
          {KNOWLEDGE_CENTER_FEATURES.map((feature) => (
            <button
              key={feature.id}
              type="button"
              className="linkedin-mobile-analytics-knowledge-feature"
              onClick={() => handleFeatureClick(feature)}
              style={{ borderColor: FRAME_COLOR, ['--feature-accent' as string]: feature.accent }}
            >
              {feature.image ? (
                <img src={feature.image} alt="" aria-hidden style={{ width: 38, height: 28, objectFit: 'contain' }} />
              ) : (
                <span aria-hidden>{feature.icon}</span>
              )}
              <span className="linkedin-mobile-analytics-knowledge-feature-title">{feature.title}</span>
            </button>
          ))}
        </div>
      </DashboardActionModal>
    </>
  );
};
