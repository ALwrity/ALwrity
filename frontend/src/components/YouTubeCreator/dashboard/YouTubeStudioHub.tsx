import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./youtube-dashboard-layout.css";
import "./youtube-rail-controls.css";
import { YouTubeRadialWorkflow } from "./YouTubeRadialWorkflow";
import { YouTubeMobileWorkflowGrid } from "./YouTubeMobileWorkflowGrid";
import { YouTubeChannelHub } from "./YouTubeChannelHub";
import { YouTubeHubConnectButton } from "./YouTubeHubConnectButton";
import { YouTubeChannelBibleChip } from "./YouTubeChannelBibleChip";
import {
  computeYouTubeRadialLayout,
  youtubeHubCenterLeftCss,
  youtubeHubCenterYPx,
} from "./youtubeRadialLayout";
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

const DESKTOP_MIN_WIDTH_PX = 961;

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`);
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

export interface YouTubeStudioHubProps {
  connected: boolean;
  channelName?: string | null;
  channelBible?: YouTubeChannelBible | null;
  oauthLoading?: boolean;
  onConnect: () => void;
  creatorState: YouTubeCreatorState;
  onClearDraft: () => void;
  needsAnalyticsReconnect?: boolean;
  onChannelBibleSaved?: (bible: YouTubeChannelBible) => void;
  onCreatorDraftPatched?: (state: YouTubeCreatorState) => void;
}

export const YouTubeStudioHub: React.FC<YouTubeStudioHubProps> = ({
  connected,
  channelName,
  channelBible,
  oauthLoading = false,
  onConnect,
  creatorState,
  onClearDraft,
  needsAnalyticsReconnect = false,
  onChannelBibleSaved,
  onCreatorDraftPatched,
}) => {
  const isDesktop = useIsDesktop();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);
  const [containerHeight, setContainerHeight] = useState(0);
  const [workflowModal, setWorkflowModal] = useState<YouTubeWorkflowCardId | null>(
    null,
  );
  const [connectGateOpen, setConnectGateOpen] = useState(false);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const readDimensions = () => {
      if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
      if (el.parentElement && el.parentElement.clientHeight > 0) {
        setContainerHeight(el.parentElement.clientHeight);
      }
    };
    readDimensions();
    const ro = new ResizeObserver(readDimensions);
    ro.observe(el);
    if (el.parentElement) {
      const parentRo = new ResizeObserver(readDimensions);
      parentRo.observe(el.parentElement);
      return () => {
        ro.disconnect();
        parentRo.disconnect();
      };
    }
    return () => ro.disconnect();
  }, []);

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

  const layout = useMemo(
    () => computeYouTubeRadialLayout(containerWidth, containerHeight || undefined),
    [containerWidth, containerHeight],
  );

  const hubCenterLeft = youtubeHubCenterLeftCss(layout);
  const hubCenterY = youtubeHubCenterYPx(layout);
  const hubDiameter = layout.hubVisualR * 2;

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

        <div
          className="yt-studio-hub-hero"
          style={{ ["--yt-hub-center-left" as string]: hubCenterLeft }}
        >
          <div
            className="yt-studio-hub-canvas"
            ref={canvasRef}
            style={isDesktop ? { height: layout.viewH } : undefined}
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
                    left: hubCenterLeft,
                    top: hubCenterY,
                  }}
                >
                  <YouTubeChannelHub
                    hubSize={hubDiameter}
                    connected={connected}
                    channelName={channelName}
                    niche={channelBible?.niche || null}
                    isLoading={oauthLoading}
                  />
                </div>
              </>
            ) : (
              <div className="yt-studio-hub-mobile">
                <YouTubeChannelHub
                  hubSize={180}
                  connected={connected}
                  channelName={channelName}
                  niche={channelBible?.niche || null}
                  isLoading={oauthLoading}
                />
                {hubCta}
                <YouTubeMobileWorkflowGrid
                  onCardAction={handleCardAction}
                  connected={connected}
                />
              </div>
            )}
          </div>
          {isDesktop ? <div className="yt-studio-hub-connect">{hubCta}</div> : null}
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
          <div className="yt-modal-backdrop" role="presentation" onClick={() => setConnectGateOpen(false)}>
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

        <YouTubeCopilotFab />
      </div>

      <YouTubeRightRail
        connected={connected}
        channelName={channelName}
        onConnect={onConnect}
        isDesktop={isDesktop}
        needsAnalyticsReconnect={needsAnalyticsReconnect}
      />
    </div>
  );
};
