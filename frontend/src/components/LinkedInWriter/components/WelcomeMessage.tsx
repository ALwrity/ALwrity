import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LinkedInConnectionPlaceholder, LinkedInPlanConnectAction } from './LinkedInConnectionPlaceholder';
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
import { LINKEDIN_STUDIO_TOUR_SEEN_KEY, getLinkedInStudioTourSeenKey, hasSeenLinkedInStudioTour, getTourAutoStartDelayMs, shouldShowLinkedInStudioSkipReminder, markLinkedInStudioSkipReminderShown, LINKEDIN_STUDIO_TOUR_SKIP_REMINDER_MESSAGE } from '../../../utils/walkthroughs/linkedInStudioTourSteps';
import { useAuth } from '@clerk/clerk-react';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { showToastNotification } from '../../../utils/toastNotifications';
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
  const [connectWelcomeHandled, setConnectWelcomeHandled] = useState(false);
  const [connectWelcomeOpen, setConnectWelcomeOpen] = useState(false);
  const social = useLinkedInSocialConnection();
  const { connected, connectWithOAuth, disconnect, isLoading: isSocialLoading } = social;
  const { userId, isLoaded, isSignedIn } = useAuth();
  const tourSeenKey = getLinkedInStudioTourSeenKey(userId);
  const [runStudioTour, setRunStudioTour] = useState(false);
  const [tourCompact, setTourCompact] = useState(() => hasSeenLinkedInStudioTour(userId));
  // Knowledge Center modal states
  const [kcContentCoach, setKcContentCoach] = useState(false);
  const [kcQuickStart, setKcQuickStart] = useState(false);
  const [kcBestPractices, setKcBestPractices] = useState(false);
  const [kcFeatureMap, setKcFeatureMap] = useState(false);
  const [kcAskAlwrity, setKcAskAlwrity] = useState(false);

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm('Disconnect LinkedIn? You can reconnect anytime.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await disconnect();
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
    setConnectWelcomeHandled(false);
  }, [userId]);

  useEffect(() => {
    if (connected) {
      setConnectWelcomeHandled(true);
    }
  }, [connected]);

  useEffect(() => {
    setTourCompact(hasSeenLinkedInStudioTour(userId));
  }, [userId]);

  // Auto-start tour only for signed-in first-time studio visitors (after connect welcome closes).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    if (isSocialLoading) return;
    if (hasSeenLinkedInStudioTour(userId)) return;
    if (!connected && !connectWelcomeHandled) return;
    if (connectWelcomeOpen) return;
    if (workflowModal || postAnalyticsOpen || growthEngineOpen || watchdogOpen || copilotError) return;

    const timer = window.setTimeout(() => {
      setRunStudioTour(true);
    }, getTourAutoStartDelayMs());
    return () => window.clearTimeout(timer);
  }, [
    isLoaded,
    isSignedIn,
    userId,
    isSocialLoading,
    connected,
    connectWelcomeHandled,
    connectWelcomeOpen,
    workflowModal,
    postAnalyticsOpen,
    growthEngineOpen,
    watchdogOpen,
    copilotError,
  ]);

  // One gentle reminder on the visit after a skipped tour (not every visit).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    if (isSocialLoading) return;
    if (!shouldShowLinkedInStudioSkipReminder(userId)) return;
    if (connectWelcomeOpen) return;
    if (!connected && !connectWelcomeHandled) return;

    const timer = window.setTimeout(() => {
      showToastNotification(LINKEDIN_STUDIO_TOUR_SKIP_REMINDER_MESSAGE, 'info');
      markLinkedInStudioSkipReminderShown(userId);
    }, getTourAutoStartDelayMs() + 400);
    return () => window.clearTimeout(timer);
  }, [
    isLoaded,
    isSignedIn,
    userId,
    isSocialLoading,
    connectWelcomeOpen,
    connected,
    connectWelcomeHandled,
  ]);

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

  const handleTourRunChange = useCallback(
    (run: boolean) => {
      setRunStudioTour(run);
      if (!run && userId && hasSeenLinkedInStudioTour(userId)) {
        setTourCompact(true);
      }
    },
    [userId],
  );

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
        <div className="linkedin-dashboard-topbar">
          <button
            type="button"
            className={`linkedin-studio-tour-trigger${tourCompact ? ' linkedin-studio-tour-trigger--compact' : ''}`}
            data-tour="li-tour-trigger"
            onClick={() => setRunStudioTour(true)}
            aria-label="Tour guide — replay how to use LinkedIn Studio"
            title="Tour guide — how to use LinkedIn Studio"
          >
            <span className="linkedin-studio-tour-trigger-icon" aria-hidden>
              ?
            </span>
            <span className="linkedin-studio-tour-trigger-label linkedin-studio-tour-trigger-label--full">
              Tour guide
            </span>
            <span className="linkedin-studio-tour-trigger-label linkedin-studio-tour-trigger-label--short">
              Tour
            </span>
          </button>
        </div>

        <div className="linkedin-dashboard-hero-stage">
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
            key={userId ?? 'signed-out'}
            centered
            splitConnectAction
            socialConnection={social}
            isDisconnecting={isDisconnecting}
            onDisconnect={handleDisconnect}
            onConnectWelcomeDismissed={() => setConnectWelcomeHandled(true)}
            onConnectWelcomeOpenChange={setConnectWelcomeOpen}
          />
        </LinkedInDashboardHero>
        </div>

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
          data-tour="li-mobile-analytics"
          onClick={openPostAnalytics}
          aria-label="View post analytics"
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

      <LinkedInStudioTour
        run={runStudioTour}
        onRunChange={handleTourRunChange}
        storageKey={tourSeenKey ?? LINKEDIN_STUDIO_TOUR_SEEN_KEY}
        connected={connected}
      />
    </div>
  );
};
