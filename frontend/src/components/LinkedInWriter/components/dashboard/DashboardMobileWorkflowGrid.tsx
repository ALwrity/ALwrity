import React, { useState } from 'react';

import {
  DASHBOARD_WORKFLOW_CARDS,
  PLAN_PINNED_HINT_KEY,
  RECOMMENDED_WORKFLOW_CARD_ID,
  resolveDashboardWorkflowIcon,
  type DashboardWorkflowCardId,
} from './dashboardWorkflowConfig';

interface DashboardMobileWorkflowGridProps {
  onCardAction: (cardId: DashboardWorkflowCardId) => void;
  profileHubSlot?: React.ReactNode;
  contextNudgeSlot?: React.ReactNode;
  studioActionsSlot?: React.ReactNode;
}

export const DashboardMobileWorkflowGrid: React.FC<DashboardMobileWorkflowGridProps> = ({
  onCardAction,
  profileHubSlot,
  contextNudgeSlot,
  studioActionsSlot,
}) => {
  const [showPlanHint, setShowPlanHint] = useState(
    () => !sessionStorage.getItem(PLAN_PINNED_HINT_KEY)
  );

  const handleCardAction = (cardId: DashboardWorkflowCardId) => {
    if (cardId === RECOMMENDED_WORKFLOW_CARD_ID && showPlanHint) {
      sessionStorage.setItem(PLAN_PINNED_HINT_KEY, '1');
      setShowPlanHint(false);
    }
    onCardAction(cardId);
  };

  const renderWorkflowCard = (card: (typeof DASHBOARD_WORKFLOW_CARDS)[number]) => {
    const isRecommended = card.id === RECOMMENDED_WORKFLOW_CARD_ID && showPlanHint;
    const Icon = resolveDashboardWorkflowIcon(card.icon);

    return (
      <button
        key={card.id}
        type="button"
        className={`linkedin-dashboard-mobile-workflow-card${
          isRecommended ? ' linkedin-dashboard-mobile-workflow-card--recommended' : ''
        }`}
        data-tour={`li-wedge-${card.id}`}
        onClick={() => handleCardAction(card.id)}
        aria-label={`${card.title}: ${card.description}`}
        style={
          {
            '--workflow-card-accent': card.accent,
          } as React.CSSProperties
        }
      >
        {isRecommended && (
          <span className="linkedin-dashboard-mobile-workflow-badge">Start here</span>
        )}
        <span className="linkedin-dashboard-mobile-workflow-card-head">
          <span
            className="linkedin-dashboard-mobile-workflow-icon"
            style={{ color: card.accent }}
            aria-hidden
          >
            <Icon fontSize="inherit" />
          </span>
          <span className="linkedin-dashboard-mobile-workflow-label">{card.title}</span>
        </span>
        <span className="linkedin-dashboard-mobile-workflow-desc">{card.description}</span>
      </button>
    );
  };

  return (
    <section
      className="linkedin-dashboard-mobile-workflow"
      aria-label="Studio actions"
      data-tour="li-mobile-workflow"
    >
      {studioActionsSlot}

      <div className="linkedin-dashboard-mobile-workflow-header">
        <h2
          className="linkedin-dashboard-mobile-workflow-title linkedin-dashboard-mobile-workflow-title--stacked"
          aria-label="What are You Creating today"
        >
          <span>What are You</span>
          <span>
            Creating today <span className="linkedin-dashboard-mobile-workflow-title-emoji" aria-hidden>🎯</span>
          </span>
        </h2>
        {profileHubSlot}
      </div>

      {contextNudgeSlot}

      <div className="linkedin-dashboard-mobile-workflow-grid linkedin-dashboard-mobile-workflow-grid--all">
        {DASHBOARD_WORKFLOW_CARDS.map(renderWorkflowCard)}
      </div>
    </section>
  );
};
