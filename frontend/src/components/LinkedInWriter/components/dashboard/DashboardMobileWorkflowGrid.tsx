import React, { useEffect, useState } from 'react';
import {
  DASHBOARD_WORKFLOW_CARDS,
  PLAN_PINNED_HINT_KEY,
  RECOMMENDED_WORKFLOW_CARD_ID,
  WORKFLOW_MOBILE_DESCRIPTIONS,
  type DashboardWorkflowCardId,
} from './dashboardWorkflowConfig';

interface DashboardMobileWorkflowGridProps {
  onCardAction: (cardId: DashboardWorkflowCardId) => void;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

export const DashboardMobileWorkflowGrid: React.FC<DashboardMobileWorkflowGridProps> = ({
  onCardAction,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
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

  return (
    <section
      className="linkedin-dashboard-mobile-workflow"
      aria-label="Studio actions"
      data-tour="li-mobile-workflow"
    >
      <h2 className="linkedin-dashboard-mobile-workflow-title">What would you like to do?</h2>
      <div className="linkedin-dashboard-mobile-workflow-grid">
        {DASHBOARD_WORKFLOW_CARDS.map((card) => {
          const isRecommended = card.id === RECOMMENDED_WORKFLOW_CARD_ID && showPlanHint;
          return (
            <button
              key={card.id}
              type="button"
              className={`linkedin-dashboard-mobile-workflow-card${
                isRecommended ? ' linkedin-dashboard-mobile-workflow-card--recommended' : ''
              }`}
              data-tour={`li-wedge-${card.id}`}
              onClick={() => handleCardAction(card.id)}
              aria-label={`${card.title}: ${WORKFLOW_MOBILE_DESCRIPTIONS[card.id]}`}
              style={
                {
                  '--workflow-card-accent': card.accent,
                } as React.CSSProperties
              }
            >
              {isRecommended && (
                <span className="linkedin-dashboard-mobile-workflow-badge">Start here</span>
              )}
              <span className="linkedin-dashboard-mobile-workflow-icon" aria-hidden>
                {card.icon}
              </span>
              <span className="linkedin-dashboard-mobile-workflow-label">{card.title}</span>
              <span className="linkedin-dashboard-mobile-workflow-desc">
                {WORKFLOW_MOBILE_DESCRIPTIONS[card.id]}
              </span>
            </button>
          );
        })}
      </div>
      {!prefersReducedMotion && showPlanHint && (
        <p className="linkedin-dashboard-mobile-workflow-hint">
          Tip: Most creators begin with <strong>Plan</strong>, then <strong>Create</strong>.
        </p>
      )}
    </section>
  );
};
