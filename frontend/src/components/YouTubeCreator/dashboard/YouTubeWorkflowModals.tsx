import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";
import { openYouTubeCreator } from "./youtubeStudioEvents";
import { useYouTubeFullCreatorModalHost } from "./useYouTubeFullCreatorModalHost";
import { youtubeSubModalShellProps } from "./youtubeWedgeModalUi";
import {
  getYouTubeCreatorStateSnapshot,
  type YouTubeCreatorState,
} from "../../../hooks/useYouTubeCreatorState";
import { youtubeApi, type YouTubeChannelBible } from "../../../services/youtubeApi";
import {
  AnalysisWedgeModal,
  ChannelPulseModal,
  CommentAssistantModal,
  CommunityIdeasModal,
  ContentGapsModal,
  CreateWedgeModal,
  EngagementWedgeModal,
  PlanWedgeModal,
  PlaylistAttachModal,
  PublishWedgeModal,
  RemarketWedgeModal,
  RetentionModal,
  SchedulePublishModal,
  StaleRefreshModal,
  WorkflowHelperModals,
  YouTubeVideoCreatorModal,
} from "./modals";

interface YouTubeWorkflowModalsProps {
  activeModal: YouTubeWorkflowCardId | null;
  onClose: () => void;
  connected: boolean;
  onRequestConnect: () => void;
  creatorState: YouTubeCreatorState;
  onClearDraft: () => void;
  channelBibleNiche?: string | null;
  channelBible?: YouTubeChannelBible | null;
  onChannelBibleSaved?: (bible: YouTubeChannelBible) => void;
  onCreatorDraftPatched?: (state: YouTubeCreatorState) => void;
}

export const YouTubeWorkflowModals: React.FC<YouTubeWorkflowModalsProps> = ({
  activeModal,
  onClose,
  connected,
  onRequestConnect,
  creatorState,
  onClearDraft,
  channelBibleNiche,
  channelBible = null,
  onChannelBibleSaved,
  onCreatorDraftPatched,
}) => {
  const navigate = useNavigate();
  const [notifyKeys, setNotifyKeys] = useState<Record<string, boolean>>({});
  const [coachOpen, setCoachOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [thumbOpen, setThumbOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [costText, setCostText] = useState("");
  const [videosOpen, setVideosOpen] = useState(false);
  const [videos, setVideos] = useState<string[]>([]);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { fullCreatorOpen, closeFullCreatorModal } = useYouTubeFullCreatorModalHost(onClose);

  useEffect(() => {
    // Clear drill-downs whenever the active wedge changes (including close).
    // Do not clear fullCreatorOpen — event host owns that independently.
    setCoachOpen(false);
    setSeoOpen(false);
    setThumbOpen(false);
    setCostOpen(false);
    setVideosOpen(false);
    setPulseOpen(false);
    setRetentionOpen(false);
    setGapsOpen(false);
    setCommentsOpen(false);
    setCommunityOpen(false);
    setStaleOpen(false);
    setPlaylistOpen(false);
    setScheduleOpen(false);
  }, [activeModal]);

  const createDrillOpen = seoOpen || thumbOpen;
  const publishDrillOpen =
    coachOpen || costOpen || videosOpen || scheduleOpen || playlistOpen;
  const analysisDrillOpen =
    pulseOpen || retentionOpen || gapsOpen || seoOpen || staleOpen;
  const engagementDrillOpen = commentsOpen || communityOpen;
  const remarketDrillOpen = staleOpen;

  const markNotify = useCallback((key: string) => {
    setNotifyKeys((prev) => ({ ...prev, [key]: true }));
    try {
      localStorage.setItem(`yt_notify_${key}`, "1");
    } catch (err) {
      console.warn("[YouTubeWorkflowModals] notify preference save failed", err);
    }
  }, []);

  const loadVideos = useCallback(async () => {
    try {
      const res = await youtubeApi.listVideos();
      setVideos((res.videos || []).map((v) => v.filename || v.video_url));
    } catch (err) {
      console.error("[YouTubeWorkflowModals] listVideos failed", err);
      setVideos([]);
    }
  }, []);

  const loadCost = useCallback(async () => {
    try {
      const enabled = creatorState.scenes.filter((s) => s.enabled !== false);
      if (enabled.length === 0) {
        setCostText("Build scenes first to estimate render cost.");
        return;
      }
      const res = await youtubeApi.estimateCost({
        scenes: enabled,
        resolution: creatorState.resolution,
      });
      if (res.estimate) {
        const min = res.estimate.estimated_cost_range?.min;
        const max = res.estimate.estimated_cost_range?.max;
        setCostText(
          `Est. $${Number(min ?? res.estimate.total_cost).toFixed(2)} – $${Number(max ?? res.estimate.total_cost).toFixed(2)} across ${res.estimate.num_scenes} scenes (${res.estimate.resolution}).`,
        );
      } else {
        setCostText(res.message || "Cost estimate unavailable.");
      }
    } catch (err: any) {
      console.error("[YouTubeWorkflowModals] estimateCost failed", err);
      setCostText(err?.message || "Could not estimate cost right now.");
    }
  }, [creatorState]);

  /** Closes active wedge; openYouTubeCreator opens Full Creator modal via Hub host. */
  const goCreate = (detail?: Parameters<typeof openYouTubeCreator>[0]) => {
    onClose();
    openYouTubeCreator(detail);
  };

  const handleCloseFullCreator = useCallback(() => {
    closeFullCreatorModal();
    try {
      const snapshot = getYouTubeCreatorStateSnapshot();
      onCreatorDraftPatched?.(snapshot);
      console.info("[YouTubeWorkflowModals] Full Creator closed — returned to Hub", {
        activeStep: snapshot.activeStep,
        hasPlan: Boolean(snapshot.videoPlan),
      });
    } catch (err) {
      console.error(
        "[YouTubeWorkflowModals] Failed to refresh Hub draft after Full Creator close",
        err,
      );
    }
  }, [closeFullCreatorModal, onCreatorDraftPatched]);

  const subShell = (onBack: () => void) => {
    if (!activeModal) {
      return {
        maxWidth: 1100,
        onBack,
        backLabel: "Studio Hub",
      };
    }
    return youtubeSubModalShellProps(activeModal, onBack);
  };

  return (
    <>
      <PlanWedgeModal
        open={activeModal === "plan"}
        onClose={onClose}
        goCreate={goCreate}
        markNotify={markNotify}
        notifyKeys={notifyKeys}
        channelBible={channelBible}
        planAvatarUrl={creatorState.avatarUrl || null}
        onChannelBibleSaved={onChannelBibleSaved}
        onCreatorDraftPatched={onCreatorDraftPatched}
      />
      <CreateWedgeModal
        open={activeModal === "create" && !createDrillOpen && !fullCreatorOpen}
        onClose={onClose}
        goCreate={goCreate}
        creatorState={creatorState}
        onOpenSeo={() => setSeoOpen(true)}
        onOpenThumb={() => setThumbOpen(true)}
      />
      <PublishWedgeModal
        open={activeModal === "publish" && !publishDrillOpen}
        onClose={onClose}
        goCreate={goCreate}
        connected={connected}
        onRequestConnect={onRequestConnect}
        creatorState={creatorState}
        onOpenDrafts={() => {
          setVideosOpen(true);
          void loadVideos();
        }}
        onOpenCoach={() => setCoachOpen(true)}
        onOpenCost={() => {
          setCostOpen(true);
          void loadCost();
        }}
        onOpenSchedule={() => setScheduleOpen(true)}
        onOpenPlaylist={() => setPlaylistOpen(true)}
      />
      <AnalysisWedgeModal
        open={activeModal === "analysis" && !analysisDrillOpen}
        onClose={onClose}
        goCreate={goCreate}
        connected={connected}
        onRequestConnect={onRequestConnect}
        onOpenPulse={() => setPulseOpen(true)}
        onOpenStale={() => setStaleOpen(true)}
        onOpenSeo={() => setSeoOpen(true)}
        onOpenGaps={() => setGapsOpen(true)}
        onOpenRetention={() => setRetentionOpen(true)}
      />
      <EngagementWedgeModal
        open={activeModal === "engagement" && !engagementDrillOpen}
        onClose={onClose}
        goCreate={goCreate}
        connected={connected}
        onRequestConnect={onRequestConnect}
        creatorState={creatorState}
        onOpenComments={() => setCommentsOpen(true)}
        onOpenCommunity={() => setCommunityOpen(true)}
      />
      <RemarketWedgeModal
        open={activeModal === "remarket" && !remarketDrillOpen}
        onClose={onClose}
        goCreate={goCreate}
        connected={connected}
        onRequestConnect={onRequestConnect}
        creatorState={creatorState}
        onOpenStale={() => setStaleOpen(true)}
        onNavigateBlog={() => {
          onClose();
          navigate("/blog-writer");
        }}
        onNavigateLibrary={() => {
          onClose();
          navigate("/asset-library?source_module=youtube_creator");
        }}
      />

      <WorkflowHelperModals
        activeModal={activeModal}
        creatorState={creatorState}
        goCreate={goCreate}
        onClearDraft={onClearDraft}
        coachOpen={coachOpen}
        seoOpen={seoOpen}
        thumbOpen={thumbOpen}
        costOpen={costOpen}
        videosOpen={videosOpen}
        costText={costText}
        videos={videos}
        onCloseCoach={() => setCoachOpen(false)}
        onCloseSeo={() => setSeoOpen(false)}
        onCloseThumb={() => setThumbOpen(false)}
        onCloseCost={() => setCostOpen(false)}
        onCloseVideos={() => setVideosOpen(false)}
      />

      <ChannelPulseModal
        open={pulseOpen}
        onClose={() => setPulseOpen(false)}
        shell={subShell(() => setPulseOpen(false))}
      />
      <RetentionModal
        open={retentionOpen}
        onClose={() => setRetentionOpen(false)}
        shell={subShell(() => setRetentionOpen(false))}
      />
      <ContentGapsModal
        open={gapsOpen}
        onClose={() => setGapsOpen(false)}
        niche={channelBibleNiche}
        shell={subShell(() => setGapsOpen(false))}
      />
      <CommentAssistantModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        niche={channelBibleNiche}
        shell={subShell(() => setCommentsOpen(false))}
      />
      <CommunityIdeasModal
        open={communityOpen}
        onClose={() => setCommunityOpen(false)}
        niche={channelBibleNiche}
        recentTitle={
          creatorState.videoPlan?.selected_title || creatorState.videoPlan?.title_suggestions?.[0]
        }
        shell={subShell(() => setCommunityOpen(false))}
      />
      <StaleRefreshModal
        open={staleOpen}
        onClose={() => setStaleOpen(false)}
        niche={channelBibleNiche}
        shell={subShell(() => setStaleOpen(false))}
      />
      <PlaylistAttachModal
        open={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        shell={subShell(() => setPlaylistOpen(false))}
      />
      <SchedulePublishModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        shell={subShell(() => setScheduleOpen(false))}
      />

      <YouTubeVideoCreatorModal open={fullCreatorOpen} onClose={handleCloseFullCreator} />
    </>
  );
};
