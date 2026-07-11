import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LinkedInConnectionPlaceholder, LinkedInPlanConnectAction, CONNECT_WELCOME_DISMISSED_KEY } from './LinkedInConnectionPlaceholder';
import { InfoModals } from './InfoModals';
import { QuickCreate } from './QuickCreate';
import { LinkedInPreferences } from '../utils/storageUtils';
import { LinkedInDashboardHero } from './dashboard/LinkedInDashboardHero';
import { DashboardRightRail } from './dashboard/DashboardRightRail';
import { DashboardCopilotFab } from './dashboard/DashboardCopilotFab';
import { WatchdogDashboard } from './WatchdogDashboard';
import type { KnowledgeCenterAction } from './dashboard/KnowledgeCenterDock';
import type { DashboardWorkflowCardId } from './dashboard/dashboardWorkflowConfig';
import {
  WorkflowActionModals,
  isWorkflowModalId,
  type WorkflowModalId,
} from './dashboard/WorkflowActionModals';
import { DashboardSimpleErrorModal } from './dashboard/DashboardSimpleErrorModal';
import { LinkedInStudioTour } from './dashboard/LinkedInStudioTour';
import { LINKEDIN_STUDIO_TOUR_SEEN_KEY } from '../../../utils/walkthroughs/linkedInStudioTourSteps';
import { useAuth } from '@clerk/clerk-react';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import {
  ContentCoachModal,
  QuickStartWizardModal,
  BestPracticesModal,
  FeatureMapModal,
  AskAlwrityModal,
} from './dashboard/KnowledgeCenterModals';
import { PostAnalyticsModal } from './dashboard/PostAnalyticsModal';
import { GrowthEngineModal } from './dashboard/GrowthEngineModal';
import {
  OPEN_GROWTH_ENGINE_EVENT,
  OPEN_POST_ANALYTICS_EVENT,
} from '../utils/linkedInDashboardEvents';

interface WelcomeMessageProps {
  draft: string;
  isGenerating: boolean;
  onGeneratePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateArticle: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateCarousel: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateVideoScript: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateOutline: (params?: any) => Promise<{ success: boolean; outline?: any; error?: string }>;
  outlineMode: boolean;
  userPreferences: LinkedInPreferences;
  onGenerateSimilarPost?: (prompt: string) => void;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  draft,
  isGenerating,
  onGeneratePost,
  onGenerateArticle,
  onGenerateCarousel,
  onGenerateVideoScript,
  onGenerateOutline,
  outlineMode,
  userPreferences,
  onGenerateSimilarPost,
}) => {
  const [showCopilotModal, setShowCopilotModal] = useState(false);
  const [showAssistiveModal, setShowAssistiveModal] = useState(false);
  const [showFactCheckModal, setShowFactCheckModal] = useState(false);
  const [workflowModal, setWorkflowModal] = useState<WorkflowModalId | null>(null);
  const [postAnalyticsOpen, setPostAnalyticsOpen] = useState(false);
  const [growthEngineOpen, setGrowthEngineOpen] = useState(false);
  const [watchdogOpen, setWatchdogOpen] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [runStudioTour, setRunStudioTour] = useState(false);
  // Knowledge Center modal states
  const [kcContentCoach, setKcContentCoach] = useState(false);
  const [kcQuickStart, setKcQuickStart] = useState(false);
  const [kcBestPractices, setKcBestPractices] = useState(false);
  const [kcFeatureMap, setKcFeatureMap] = useState(false);
  const [kcAskAlwrity, setKcAskAlwrity] = useState(false);
  const social = useLinkedInSocialConnection();
  const { connected, connectWithOAuth, disconnect, isLoading: isSocialLoading } = social;
  const { userId } = useAuth();
  const tourSeenKey = userId
    ? `${LINKEDIN_STUDIO_TOUR_SEEN_KEY}_${userId}`
    : LINKEDIN_STUDIO_TOUR_SEEN_KEY;

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm('Disconnect LinkedIn? You can reconnect anytime.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await disconnect();
      sessionStorage.removeItem(CONNECT_WELCOME_DISMISSED_KEY);
    } finally {
      setIsDisconnecting(false);
    }
  }, [disconnect]);

  useEffect(() => {
    document.body.classList.add('linkedin-dashboard-view');
    return () => document.body.classList.remove('linkedin-dashboard-view');
  }, []);

  useEffect(() => {
    const onOpenPostAnalytics = () => setPostAnalyticsOpen(true);
    const onOpenGrowthEngine = () => setGrowthEngineOpen(true);
    window.addEventListener(OPEN_POST_ANALYTICS_EVENT, onOpenPostAnalytics);
    window.addEventListener(OPEN_GROWTH_ENGINE_EVENT, onOpenGrowthEngine);
    return () => {
      window.removeEventListener(OPEN_POST_ANALYTICS_EVENT, onOpenPostAnalytics);
      window.removeEventListener(OPEN_GROWTH_ENGINE_EVENT, onOpenGrowthEngine);
    };
  }, []);

  useEffect(() => {
    const onOpenWatchdog = () => setWatchdogOpen(true);
    window.addEventListener('linkedinwriter:openWatchdog', onOpenWatchdog);
    return () => window.removeEventListener('linkedinwriter:openWatchdog', onOpenWatchdog);
  }, []);

  useEffect(() => {
    const onOpenBrainstorm = () => setWorkflowModal('plan');
    window.addEventListener('linkedinwriter:openBrainstorm', onOpenBrainstorm);
    return () => window.removeEventListener('linkedinwriter:openBrainstorm', onOpenBrainstorm);
  }, []);

  useEffect(() => {
    const onStartTour = () => setRunStudioTour(true);
    window.addEventListener('linkedinwriter:startStudioTour', onStartTour);
    return () => window.removeEventListener('linkedinwriter:startStudioTour', onStartTour);
  }, []);

  useEffect(() => {
    if (isSocialLoading) return;
    if (localStorage.getItem(tourSeenKey)) return;

    const timer = window.setTimeout(() => {
      setRunStudioTour(true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [isSocialLoading, tourSeenKey]);

  useEffect(() => {
    const requireConnection = (event: Event) => {
      if (connected) return;
      event.stopImmediatePropagation();
      void connectWithOAuth();
    };

    window.addEventListener('linkedinwriter:getTopicIdeas', requireConnection, true);
    window.addEventListener('linkedinwriter:openOptimiseProfile', requireConnection, true);
    return () => {
      window.removeEventListener('linkedinwriter:getTopicIdeas', requireConnection, true);
      window.removeEventListener('linkedinwriter:openOptimiseProfile', requireConnection, true);
    };
  }, [connected, connectWithOAuth]);

  const handleOpenCopilot = useCallback(() => {
    const copilotToggle =
      document.querySelector('.alwrity-copilot-sidebar.copilotKitSidebar .copilotKitButton') ||
      document.querySelector('.copilotKitSidebar .copilotKitButton');

    const toggleHost = copilotToggle?.parentElement;
    if (toggleHost) {
      toggleHost.click();
      return true;
    }

    const legacyButton =
      document.querySelector('.copilotkit-open-button') ||
      document.querySelector('[data-copilot-open]') ||
      document.querySelector('button[aria-label*="Open"]');

    if (legacyButton) {
      (legacyButton as HTMLElement).click();
      return true;
    }

    setCopilotError('Could not open Co-Pilot. Refresh the page and try again.');
    return false;
  }, []);

  if (draft || isGenerating) return null;

  const openQuickCreatePost = () => {
    setWorkflowModal('create');
    window.dispatchEvent(
      new CustomEvent('linkedinwriter:openQuickCreate', { detail: { type: 'post' } })
    );
  };

  const openPostAnalytics = () => {
    setPostAnalyticsOpen(true);
  };

  const handleWorkflowCardAction = (cardId: DashboardWorkflowCardId) => {
    if (cardId === 'engagement') {
      setWorkflowModal('engagement');
      return;
    }

    if (cardId === 'remarket') {
      setWorkflowModal('remarket');
      return;
    }

    if (isWorkflowModalId(cardId)) {
      setWorkflowModal(cardId);
    }
  };

  const handleKnowledgeCenterAction = (action: KnowledgeCenterAction) => {
    switch (action) {
      // ── New AI-first features ─────────────────────────────────────────────
      case 'featureMap':
        setKcFeatureMap(true);
        break;
      case 'contentCoach':
        setKcContentCoach(true);
        break;
      case 'bestPractices':
        setKcBestPractices(true);
        break;
      case 'quickStart':
        setKcQuickStart(true);
        break;
      case 'askAlwrity':
        setKcAskAlwrity(true);
        break;
      // ── Unchanged ─────────────────────────────────────────────────────────
      case 'persona':
        window.dispatchEvent(new CustomEvent('linkedinwriter:openPreferences'));
        break;
      case 'multimodal':
        setWorkflowModal('create');
        break;
      // ── Legacy fallbacks (backward compat) ────────────────────────────────
      case 'factCheck':
        setKcFeatureMap(true);
        break;
      case 'googleGround':
        setKcAskAlwrity(true);
        break;
      case 'assistive':
        setKcBestPractices(true);
        break;
      case 'copilot':
        setKcQuickStart(true);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className="linkedin-dashboard-layout"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        className="linkedin-dashboard-main"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '0 8px 0',
          color: '#666',
        }}
      >
        <button
          type="button"
          className="linkedin-studio-tour-trigger"
          data-tour="li-tour-trigger"
          onClick={() => setRunStudioTour(true)}
          aria-label="How to use LinkedIn Studio — start guided tour"
          title="Tour guide — how to use LinkedIn Studio"
        >
          <span aria-hidden>?</span>
          <span className="linkedin-studio-tour-trigger-label">Tour guide</span>
        </button>

        <LinkedInDashboardHero
          onWorkflowCardAction={handleWorkflowCardAction}
          planAnchorSlot={
            <LinkedInPlanConnectAction
              social={social}
              isDisconnecting={isDisconnecting}
              onDisconnect={handleDisconnect}
            />
          }
        >
          <LinkedInConnectionPlaceholder
            centered
            splitConnectAction
            socialConnection={social}
            isDisconnecting={isDisconnecting}
            onDisconnect={handleDisconnect}
          />
        </LinkedInDashboardHero>

        <QuickCreate
          variant="hidden"
          onGeneratePost={onGeneratePost}
          onGenerateArticle={onGenerateArticle}
          onGenerateCarousel={onGenerateCarousel}
          onGenerateVideoScript={onGenerateVideoScript}
          onGenerateOutline={onGenerateOutline}
          outlineMode={outlineMode}
          userPreferences={userPreferences}
        />

        <WorkflowActionModals
          activeModal={workflowModal}
          onClose={() => setWorkflowModal(null)}
        />

        <button
          type="button"
          className="linkedin-mobile-analytics-teaser"
          onClick={openPostAnalytics}
        >
          View Post Analytics →
        </button>

        <InfoModals
          showCopilotModal={showCopilotModal}
          showAssistiveModal={showAssistiveModal}
          showFactCheckModal={showFactCheckModal}
          onCloseCopilotModal={() => setShowCopilotModal(false)}
          onCloseAssistiveModal={() => setShowAssistiveModal(false)}
          onCloseFactCheckModal={() => setShowFactCheckModal(false)}
          onOpenCopilot={handleOpenCopilot}
          onStartQuickCreatePost={() => {
            setShowAssistiveModal(false);
            setShowFactCheckModal(false);
            openQuickCreatePost();
          }}
        />

        {/* ── Knowledge Center Modals ── */}
        <ContentCoachModal open={kcContentCoach} onClose={() => setKcContentCoach(false)} />
        <QuickStartWizardModal open={kcQuickStart} onClose={() => setKcQuickStart(false)} />
        <BestPracticesModal open={kcBestPractices} onClose={() => setKcBestPractices(false)} />
        <FeatureMapModal
          open={kcFeatureMap}
          onClose={() => setKcFeatureMap(false)}
          onOpenWedge={(id) => {
            const cardId = id as DashboardWorkflowCardId;
            if (isWorkflowModalId(cardId)) setWorkflowModal(cardId);
          }}
          onOpenCapability={(id) => handleKnowledgeCenterAction(id as KnowledgeCenterAction)}
        />
        <AskAlwrityModal open={kcAskAlwrity} onClose={() => setKcAskAlwrity(false)} />

        <div className="linkedin-dashboard-copilot-fab">
          <DashboardCopilotFab onOpenCopilot={handleOpenCopilot} variant="corner" />
        </div>

        <div className="linkedin-mobile-copilot-fab">
          <DashboardCopilotFab onOpenCopilot={handleOpenCopilot} variant="fixed" />
        </div>

        {watchdogOpen &&
          createPortal(
            <WatchdogDashboard
              onClose={() => setWatchdogOpen(false)}
              generatePost={onGeneratePost}
              userPreferences={userPreferences}
              onUnreadChanged={() => {}}
            />,
            document.body
          )}
      </div>

      <DashboardRightRail
        onViewAllAnalytics={openPostAnalytics}
        onKnowledgeCenterAction={handleKnowledgeCenterAction}
      />

      <PostAnalyticsModal
        open={postAnalyticsOpen}
        onClose={() => setPostAnalyticsOpen(false)}
        onGenerateSimilarPost={onGenerateSimilarPost}
      />

      <GrowthEngineModal
        open={growthEngineOpen}
        onClose={() => setGrowthEngineOpen(false)}
        generatePost={onGeneratePost}
        userPreferences={userPreferences}
      />

      <DashboardSimpleErrorModal
        open={Boolean(copilotError)}
        title="Co-Pilot unavailable"
        message={copilotError ?? ''}
        onClose={() => setCopilotError(null)}
      />

      <LinkedInStudioTour run={runStudioTour} onRunChange={setRunStudioTour} storageKey={tourSeenKey} />
    </div>
  );
};
