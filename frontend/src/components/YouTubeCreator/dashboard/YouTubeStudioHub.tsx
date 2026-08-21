import React, { useCallback, useEffect, useRef, useState } from "react";
import "./youtube-dashboard-layout.css";
import "./youtube-rail-controls.css";
import "./youtube-mobile-landing.css";
import { YouTubeRadialWorkflow } from "./YouTubeRadialWorkflow";
import { YouTubeMobileWorkflowGrid } from "./YouTubeMobileWorkflowGrid";
import { YouTubeChannelHub } from "./YouTubeChannelHub";
import { YouTubeChannelHubStrip } from "./YouTubeChannelHubStrip";
import { YouTubeHubConnectButton } from "./YouTubeHubConnectButton";
import { YouTubeMobileStudioActionsDock } from "./YouTubeMobileStudioActionsDock";
import { YouTubeMobileAnalyticsSection } from "./YouTubeMobileAnalyticsSection";
import { YouTubeChannelBibleChip } from "./YouTubeChannelBibleChip";
import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";
import { resolveWedgeNavigation } from "./studioHubWedgeNavigation";
import { YouTubeWorkflowModals } from "./YouTubeWorkflowModals";
import { YouTubeRightRail } from "./YouTubeRightRail";
import { YouTubeTodayGrowth } from "./YouTubeTodayGrowth";
import { YouTubeResumeDraftChip } from "./YouTubeResumeDraftChip";
import { StartNewVideoButton } from "../components/StartNewVideoButton";
import { hasYouTubeCreatorDraft } from "../utils/youtubeCreatorDraftUtils";
import { YouTubeCopilotFab } from "./YouTubeCopilotFab";
import {
  openYouTubeCreator,
  YT_OPEN_WEDGE_EVENT,
  type YouTubeOpenWedgeDetail,
} from "./youtubeStudioEvents";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import { useYouTubeDesktopViewport } from "./useYouTubeDesktopViewport";
import { useYouTubeHeroLayoutMetrics } from "./useYouTubeHeroLayoutMetrics";
import { HUB_CENTER_LEFT_CSS_VAR } from "./youtubeLayoutConstants";

export interface YouTubeStudioHubProps {
  connected: boolean;
  channelName?: string | null;
  channelBible?: YouTubeChannelBible | null;
  oauthLoading?: boolean;
  onConnect: () => void;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  creatorState: YouTubeCreatorState;
  onClearDraft: () => void;
  needsAnalyticsReconnect?: boolean;
  onChannelBibleSaved?: (bible: YouTubeChannelBible) => void;
  onCreatorDraftPatched?: (state: YouTubeCreatorState) => void;
}

export function YouTubeStudioHub({
  connected,
  channelName,
  channelBible,
  oauthLoading = false,
  onConnect,
  onDisconnect,
  isDisconnecting = false,
  creatorState,
  onClearDraft,
  needsAnalyticsReconnect = false,
  onChannelBibleSaved,
  onCreatorDraftPatched,
}: YouTubeStudioHubProps) {
  const isDesktop = useYouTubeDesktopViewport();
  const heroStageRef = useRef<HTMLDivElement>(null);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [workflowModal, setWorkflowModal] = useState<YouTubeWorkflowCardId | null>(null);
  const [connectGateOpen, setConnectGateOpen] = useState(false);

  const { layout, hubCenterLeft, hubCenterY, hubDiameter, hubAvatarSize } =
    useYouTubeHeroLayoutMetrics({
      isDesktop,
      heroStageRef,
      heroContainerRef,
      canvasRef,
    });
  const hubAxisLeft = isDesktop ? `var(${HUB_CENTER_LEFT_CSS_VAR})` : hubCenterLeft;

  useEffect(() => {
    const onOpenWedge = (event: Event) => {
      const detail = (event as CustomEvent<YouTubeOpenWedgeDetail>).detail;
      if (!detail?.wedge) return;
      resolveWedgeNavigation(
        detail.wedge,
        connected,
        setWorkflowModal,
        () => setConnectGateOpen(true),
      );
    };
    window.addEventListener(YT_OPEN_WEDGE_EVENT, onOpenWedge);
    return () => window.removeEventListener(YT_OPEN_WEDGE_EVENT, onOpenWedge);
  }, [connected]);

  useEffect(() => {
    const stage = heroStageRef.current;
    if (!stage) return;
    if (isDesktop) {
      stage.style.setProperty(HUB_CENTER_LEFT_CSS_VAR, hubCenterLeft);
    } else {
      stage.style.removeProperty(HUB_CENTER_LEFT_CSS_VAR);
    }
  }, [isDesktop, hubCenterLeft]);

  const hasDraft = hasYouTubeCreatorDraft(creatorState);

  const draftPreview =
    creatorState.videoPlan?.selected_title ||
    creatorState.videoPlan?.title_suggestions?.[0] ||
    creatorState.userIdea?.slice(0, 120) ||
    "Untitled video draft";

  const handleCardAction = useCallback(
    (cardId: YouTubeWorkflowCardId) => {
      resolveWedgeNavigation(
        cardId,
        connected,
        setWorkflowModal,
        () => setConnectGateOpen(true),
      );
    },
    [connected],
  );

  const hubCta = (
    <YouTubeHubConnectButton
      connected={connected}
      onConnect={onConnect}
      onCreateVideo={() => openYouTubeCreator({ step: 0 })}
    />
  );

  return (
    <div className="yt-studio-hub" data-tour="yt-studio-hub">
      <div className="yt-studio-hub-main">
        {isDesktop ? (
          <div className="yt-studio-hub-toolbar">
            <YouTubeTodayGrowth />
            <YouTubeChannelBibleChip
              niche={channelBible?.niche || null}
              planAvatarUrl={creatorState.avatarUrl || null}
              onBibleSaved={onChannelBibleSaved}
            />
            {hasDraft ? (
              <StartNewVideoButton
                variant="hub"
                onConfirm={() => {
                  onClearDraft();
                  openYouTubeCreator({ step: 0 });
                }}
              />
            ) : null}
            <YouTubeResumeDraftChip
              hasDraft={hasDraft}
              preview={draftPreview}
              onDiscard={onClearDraft}
            />
          </div>
        ) : null}

        <div
          ref={heroStageRef}
          className="yt-studio-hub-hero-stage"
          style={{
            [HUB_CENTER_LEFT_CSS_VAR as string]: isDesktop ? hubCenterLeft : undefined,
          }}
        >
          <div
            className="yt-studio-hub-hero"
            ref={heroContainerRef}
            style={
              isDesktop
                ? {
                    width: "100%",
                    flex: "0 1 auto",
                    minHeight: 0,
                    height: "auto",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    overflow: "hidden",
                    position: "static",
                    paddingTop: 0,
                  }
                : undefined
            }
          >
            <div
              className="yt-studio-hub-canvas"
              ref={canvasRef}
              style={isDesktop ? { height: layout.viewH, flexShrink: 0, zIndex: 1 } : undefined}
            >
              {isDesktop ? (
                <>
                  <YouTubeRadialWorkflow
                    layout={layout}
                    onCardAction={handleCardAction}
                    connected={connected}
                  />
                  <div
                    className="yt-studio-hub-hub"
                    style={{
                      width: hubDiameter,
                      maxWidth: hubDiameter,
                      left: hubAxisLeft,
                      top: hubCenterY,
                      ["--hub-inner-diameter" as string]: `${hubDiameter}px`,
                      ["--hub-avatar-size" as string]: `${hubAvatarSize}px`,
                    }}
                  >
                    <YouTubeChannelHub
                      hubSize={hubDiameter}
                      avatarSize={hubAvatarSize}
                      connected={connected}
                      channelName={channelName}
                      niche={channelBible?.niche || null}
                      isLoading={oauthLoading}
                    />
                  </div>
                </>
              ) : (
                <div className="yt-studio-hub-mobile">
                  <YouTubeMobileWorkflowGrid
                    onCardAction={handleCardAction}
                    connected={connected}
                    studioActionsSlot={
                      <YouTubeMobileStudioActionsDock
                        hasDraft={hasDraft}
                        draftPreview={draftPreview}
                        niche={channelBible?.niche || null}
                        planAvatarUrl={creatorState.avatarUrl || null}
                        onBibleSaved={onChannelBibleSaved}
                        onClearDraft={onClearDraft}
                        onStartNewVideo={() => {
                          onClearDraft();
                          openYouTubeCreator({ step: 0 });
                        }}
                      />
                    }
                    profileHubSlot={
                      <YouTubeChannelHubStrip
                        connected={connected}
                        channelName={channelName}
                        isLoading={oauthLoading}
                        onConnect={onConnect}
                        onDisconnect={onDisconnect}
                        isDisconnecting={isDisconnecting}
                      />
                    }
                  />
                  <YouTubeMobileAnalyticsSection
                    connected={connected}
                    channelName={channelName}
                    onConnect={onConnect}
                    needsAnalyticsReconnect={needsAnalyticsReconnect}
                  />
                </div>
              )}
            </div>
          </div>

          {isDesktop ? (
            <div className="yt-studio-hub-connect-anchor yt-studio-hub-connect-anchor--hub-bottom">
              {hubCta}
            </div>
          ) : null}
        </div>

        <YouTubeWorkflowModals
          activeModal={workflowModal}
          onClose={() => setWorkflowModal(null)}
          connected={connected}
          onRequestConnect={onConnect}
          creatorState={creatorState}
          onClearDraft={onClearDraft}
          channelBibleNiche={channelBible?.niche || null}
          channelBible={channelBible}
          onChannelBibleSaved={onChannelBibleSaved}
          onCreatorDraftPatched={onCreatorDraftPatched}
        />

        {connectGateOpen && (
          <div
            className="yt-modal-backdrop"
            role="presentation"
            onClick={() => setConnectGateOpen(false)}
          >
            <div
              className="yt-modal-card"
              role="dialog"
              aria-modal="true"
              aria-label="Connect YouTube"
              style={{ width: "min(420px, 100%)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="yt-modal-header">
                <h2>Connect YouTube</h2>
                <button
                  type="button"
                  className="yt-modal-close"
                  onClick={() => setConnectGateOpen(false)}
                >
                  ×
                </button>
              </div>
              <p className="yt-modal-intro">
                Analysis, Engagement, and Remarket unlock after you connect your channel. Plan and
                Create stay available offline.
              </p>
              <button
                type="button"
                className="yt-rail-btn yt-rail-btn--primary"
                onClick={() => {
                  setConnectGateOpen(false);
                  onConnect();
                }}
              >
                Connect YouTube
              </button>
            </div>
          </div>
        )}

        <div className="yt-studio-bottom-dock" aria-label="Studio actions">
          <div className="yt-studio-copilot-fab">
            <YouTubeCopilotFab variant="corner" />
          </div>
        </div>

        <div className="yt-studio-mobile-copilot-fab" data-tour="yt-mobile-copilot-fab">
          <YouTubeCopilotFab variant="fixed" />
        </div>
      </div>

      {isDesktop ? (
        <YouTubeRightRail
          connected={connected}
          channelName={channelName}
          onConnect={onConnect}
          isDesktop
          needsAnalyticsReconnect={needsAnalyticsReconnect}
        />
      ) : null}
    </div>
  );
}
