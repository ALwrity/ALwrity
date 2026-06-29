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
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';

interface WelcomeMessageProps {
  draft: string;
  isGenerating: boolean;
  onGeneratePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateArticle: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateCarousel: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateVideoScript: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  userPreferences: LinkedInPreferences;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  draft,
  isGenerating,
  onGeneratePost,
  onGenerateArticle,
  onGenerateCarousel,
  onGenerateVideoScript,
  userPreferences,
}) => {
  const [showCopilotModal, setShowCopilotModal] = useState(false);
  const [showAssistiveModal, setShowAssistiveModal] = useState(false);
  const [showFactCheckModal, setShowFactCheckModal] = useState(false);
  const [workflowModal, setWorkflowModal] = useState<WorkflowModalId | null>(null);
  const [watchdogOpen, setWatchdogOpen] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [runStudioTour, setRunStudioTour] = useState(false);
  const social = useLinkedInSocialConnection();
  const { connected, connectWithOAuth, disconnect, isLoading: isSocialLoading } = social;

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
    const onOpenWatchdog = () => setWatchdogOpen(true);
    window.addEventListener('linkedinwriter:openWatchdog', onOpenWatchdog);
    return () => window.removeEventListener('linkedinwriter:openWatchdog', onOpenWatchdog);
  }, []);

  useEffect(() => {
    const onStartTour = () => setRunStudioTour(true);
    window.addEventListener('linkedinwriter:startStudioTour', onStartTour);
    return () => window.removeEventListener('linkedinwriter:startStudioTour', onStartTour);
  }, []);

  useEffect(() => {
    if (isSocialLoading) return;
    if (localStorage.getItem(LINKEDIN_STUDIO_TOUR_SEEN_KEY)) return;

    const timer = window.setTimeout(() => setRunStudioTour(true), 800);
    return () => window.clearTimeout(timer);
  }, [isSocialLoading]);

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

  const openAnalyticsTab = () => {
    window.dispatchEvent(
      new CustomEvent('linkedinwriter:switchTab', { detail: { tab: 'analytics' } })
    );
  };

  const handleWorkflowCardAction = (cardId: DashboardWorkflowCardId) => {
    if (cardId === 'engagement') {
      window.dispatchEvent(
        new CustomEvent('linkedinwriter:switchTab', { detail: { tab: 'growth' } })
      );
      return;
    }

    if (cardId === 'remarket') {
      openAnalyticsTab();
      return;
    }

    if (isWorkflowModalId(cardId)) {
      setWorkflowModal(cardId);
    }
  };

  const handleKnowledgeCenterAction = (action: KnowledgeCenterAction) => {
    switch (action) {
      case 'factCheck':
        setShowFactCheckModal(true);
        break;
      case 'googleGround':
        setShowAssistiveModal(true);
        break;
      case 'persona':
        window.dispatchEvent(new CustomEvent('linkedinwriter:openPreferences'));
        break;
      case 'assistive':
        setShowAssistiveModal(true);
        break;
      case 'copilot':
        handleOpenCopilot();
        break;
      case 'multimodal':
        setWorkflowModal('create');
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
          title="How to use LinkedIn Studio"
        >
          <span aria-hidden>?</span>
          <span className="linkedin-studio-tour-trigger-label">Tour</span>
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
          userPreferences={userPreferences}
        />

        <WorkflowActionModals
          activeModal={workflowModal}
          onClose={() => setWorkflowModal(null)}
        />

        <button
          type="button"
          className="linkedin-mobile-analytics-teaser"
          onClick={openAnalyticsTab}
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
        onViewAllAnalytics={openAnalyticsTab}
        onOpenCopilot={handleOpenCopilot}
        onKnowledgeCenterAction={handleKnowledgeCenterAction}
      />

      <DashboardSimpleErrorModal
        open={Boolean(copilotError)}
        title="Co-Pilot unavailable"
        message={copilotError ?? ''}
        onClose={() => setCopilotError(null)}
      />

      <LinkedInStudioTour run={runStudioTour} onRunChange={setRunStudioTour} />
    </div>
  );
};
