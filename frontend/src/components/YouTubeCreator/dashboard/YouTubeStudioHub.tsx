import React, { useCallback, useEffect, useRef, useState } from "react";
import { YouTubeRadialWorkflow } from "./YouTubeRadialWorkflow";
import { YouTubeMobileWorkflowGrid } from "./YouTubeMobileWorkflowGrid";
import { YouTubeChannelHub } from "./YouTubeChannelHub";
import { YouTubeChannelHubStrip } from "./YouTubeChannelHubStrip";
import { YouTubeHubConnectButton } from "./YouTubeHubConnectButton";
import { YouTubeSearchResultsPanel } from "./YouTubeSearchResultsPanel";
import type {
  YouTubeSearchDurationFilter,
  YouTubeSearchFilter,
  YouTubeSearchHit,
  YouTubeSearchTypeFilter,
} from "./YouTubeSearchResultsPanel";
import {
  searchYouTubeByChip,
  searchYouTubeByDuration,
  searchYouTubeByType,
} from "./youtubeHubSearchRequests";
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
import { YouTubeActionModal } from "./YouTubeActionModal";
import {
  openYouTubeCreator,
  YT_OPEN_WEDGE_EVENT,
  YT_SEARCH_RESULTS_EVENT,
  type YouTubeOpenWedgeDetail,
  type YouTubeSearchResultsDetail,
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<YouTubeSearchHit[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<YouTubeSearchFilter>("all");
  const [searchType, setSearchType] = useState<YouTubeSearchTypeFilter | undefined>(
    undefined,
  );
  const [searchDuration, setSearchDuration] = useState<
    YouTubeSearchDurationFilter | undefined
  >(undefined);

  const { layout, hubCenterLeft, hubCenterY, hubDiameter, hubAvatarSize } =
    useYouTubeHeroLayoutMetrics({
      isDesktop,
      heroStageRef,
      heroContainerRef,
      canvasRef,
    });
  const hubAxisLeft = isDesktop ? `var(${HUB_CENTER_LEFT_CSS_VAR})` : hubCenterLeft;

  useEffect(() => {
    const onSearchResults = (event: Event) => {
      const detail = (event as CustomEvent<YouTubeSearchResultsDetail>).detail;
      if (!detail) {
        console.warn("[YouTubeStudioHub] Search results event missing detail");
        return;
      }
      try {
        setSearchOpen(true);
        setSearchQuery(detail.query || "");
        setSearchItems(Array.isArray(detail.items) ? detail.items : []);
        setSearchMessage(detail.message);
        setSearchFilter("all");
        setSearchType(undefined);
        setSearchDuration(undefined);
        console.info("[YouTubeStudioHub] Search results panel opened", {
          queryLength: (detail.query || "").length,
          itemCount: Array.isArray(detail.items) ? detail.items.length : 0,
          hasMessage: Boolean(detail.message),
        });
      } catch (error) {
        console.error("[YouTubeStudioHub] Failed to apply search results", error);
      }
    };
    window.addEventListener(YT_SEARCH_RESULTS_EVENT, onSearchResults);
    return () => window.removeEventListener(YT_SEARCH_RESULTS_EVENT, onSearchResults);
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

  const handleSearchFilterChange = useCallback(
    async (filter: YouTubeSearchFilter) => {
      try {
        setSearchFilter(filter);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Search filter skipped empty query", {
            filter,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Search filter changed", {
          filter,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await searchYouTubeByChip(query, filter);
        setSearchItems(result.items);
        setSearchMessage(result.message);
      } catch (error) {
        console.error("[YouTubeStudioHub] Search filter request failed", error);
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [searchQuery],
  );

  const handleSearchTypeChange = useCallback(
    async (searchTypeNext: YouTubeSearchTypeFilter) => {
      try {
        setSearchType(searchTypeNext);
        setSearchDuration(undefined);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Search type skipped empty query", {
            searchType: searchTypeNext,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Search type changed", {
          searchType: searchTypeNext,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await searchYouTubeByType(query, searchTypeNext);
        setSearchItems(result.items);
        setSearchMessage(result.message);
      } catch (error) {
        console.error("[YouTubeStudioHub] Search type request failed", error);
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [searchQuery],
  );

  const handleSearchDurationChange = useCallback(
    async (durationNext: YouTubeSearchDurationFilter) => {
      try {
        setSearchDuration(durationNext);
        setSearchType(undefined);
        const query = searchQuery.trim();
        if (!query) {
          console.info("[YouTubeStudioHub] Search duration skipped empty query", {
            videoDuration: durationNext,
          });
          return;
        }
        console.info("[YouTubeStudioHub] Search duration changed", {
          videoDuration: durationNext,
          queryLength: query.length,
        });
        setSearchMessage("Searching...");
        const result = await searchYouTubeByDuration(query, durationNext);
        setSearchItems(result.items);
        setSearchMessage(result.message);
        console.info("[YouTubeStudioHub] Search duration complete", {
          videoDuration: durationNext,
          itemCount: result.items.length,
          hasMessage: Boolean(result.message),
        });
      } catch (error) {
        console.error(
          "[YouTubeStudioHub] Search duration request failed",
          {
            videoDuration: durationNext,
            queryLength: searchQuery.trim().length,
          },
          error,
        );
        setSearchItems([]);
        setSearchMessage("Search failed.");
      }
    },
    [searchQuery],
  );

  const hubCta = (
    <YouTubeHubConnectButton
      connected={connected}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      isLoading={oauthLoading}
      isDisconnecting={isDisconnecting}
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
        <YouTubeSearchResultsPanel
          isOpen={searchOpen}
          items={searchItems}
          message={searchMessage}
          selectedFilter={searchFilter}
          selectedType={searchType}
          selectedDuration={searchDuration}
          onFilterChange={handleSearchFilterChange}
          onTypeChange={handleSearchTypeChange}
          onDurationChange={handleSearchDurationChange}
          onClose={() => {
            try {
              setSearchOpen(false);
              console.info("[YouTubeStudioHub] Search results panel closed");
            } catch (error) {
              console.error("[YouTubeStudioHub] Failed to close search results", error);
            }
          }}
        />

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
                  <div className="yt-studio-hub-connect-anchor yt-studio-hub-connect-anchor--in-canvas">
                    {hubCta}
                  </div>
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

        <YouTubeActionModal
          open={connectGateOpen}
          title="Connect YouTube"
          intro="Analysis, Engagement, and Remarket unlock after you connect your channel. Plan and Create stay available offline."
          onClose={() => setConnectGateOpen(false)}
          maxWidth={420}
        >
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
        </YouTubeActionModal>

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
