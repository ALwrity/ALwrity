import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardActionModal } from "./DashboardActionModal";
import { DashboardToolTile } from "./DashboardToolTile";
import type { DashboardWorkflowCardId } from "./dashboardWorkflowConfig";
import { PlanWedgeModal } from "../Brainstorm/PlanWedgeModal";
import { useLinkedInSocialConnection } from "../../../../hooks/useLinkedInSocialConnection";
import {
  openGrowthEngineModal,
  openPostAnalyticsModal,
  OPEN_GROW_NETWORK_EVENT,
  type OpenGrowNetworkDetail,
} from "../../utils/linkedInDashboardEvents";
import {
  OPEN_WORKFLOW_WEDGE_EVENT,
  resolveWorkflowWedgeDetail,
  type OpenWorkflowWedgeDetailInput,
  type WorkflowModalId,
} from "./engagementWedgeNavigation";
import {
  EngagementTrendsModal,
} from "./analysisWedgeModalExports";
import {
  CommentAssistantModal,
  OpportunitiesModal,
} from "./EngagementWedgeModals";
import { PostPulseModal } from "./remarkWedgeModalExports";
import {
  getPerformancePulseTileDescription,
  PERFORMANCE_PULSE_TILE,
} from "./performancePulseTileConfig";
import { GrowNetworkModal } from "./GrowNetworkModal";
import { GROW_NETWORK_TILE, type GrowNetworkScrollTarget } from "./growNetworkConstants";
import { RepurposeLabModal } from "./repurposeLab";
import {
  FormatTransformerModal,
  ContentRefreshModal,
  StaleReviverModal,
  PerfToPlanModal,
} from "./RemarkWedgeModals";
import { DraftLibraryModal } from "./PublishWedgeModals";
import { CreateWedgeComingSoonTile } from "./CreateWedgeComingSoonTile";
import { PublishWedgeComingSoonTile } from "./PublishWedgeComingSoonTile";
import { AnalysisWedgeComingSoonTile } from "./AnalysisWedgeComingSoonTile";
import { useCreateWedgeNotify } from "../../hooks/useCreateWedgeNotify";
import { usePublishWedgeNotify } from "../../hooks/usePublishWedgeNotify";
import { useAnalysisWedgeNotify } from "../../hooks/useAnalysisWedgeNotify";
import {
  isCreateWedgeContentTypeLocked,
  type CreateWedgeLockedContentType,
} from "../../utils/linkedInConnectLockedUi";
import { isPublishWedgeFeatureLocked } from "../../utils/linkedInPublishWedgeLockedUi";
import { isAnalysisWedgeFeatureLocked } from "../../utils/linkedInAnalysisWedgeLockedUi";

type AnalysisSub = "trends" | null;
type EngagementSub =
  | "comment"
  | "opportunities"
  | "grow_network"
  /** @deprecated Opens Grow Network (AI section) */
  | "network"
  /** @deprecated Opens Grow Network (PYMK section) */
  | "pymk"
  | null;
type RemarkSub =
  | "repurpose"
  | "transformer"
  | "refresh"
  | "reviver"
  | "perf_plan"
  | "pulse"
  | null;
type PublishSub = "drafts" | null;

export type { WorkflowModalId } from "./engagementWedgeNavigation";

interface WorkflowActionModalsProps {
  activeModal: WorkflowModalId | null;
  onClose: () => void;
  onOpenWedge?: (wedge: WorkflowModalId) => void;
}

const CREATE_TILE_TOOLS = [
  {
    id: "post",
    title: "Post",
    description: "Professional LinkedIn post with engagement hooks",
    icon: "📝",
    accent: "#0a66c2",
  },
  {
    id: "article",
    title: "Article",
    description: "Thought leadership article with in-depth analysis",
    icon: "📄",
    accent: "#057642",
  },
  {
    id: "video_script",
    title: "Video Script",
    description: "Engaging video script with hook & scenes",
    icon: "🎬",
    accent: "#dc2626",
  },
  {
    id: "carousel",
    title: "Carousel",
    description: "Multi-slide carousel for visual storytelling",
    icon: "🎠",
    accent: "#8b5cf6",
  },
];

export const WorkflowActionModals: React.FC<WorkflowActionModalsProps> = ({
  activeModal,
  onClose,
  onOpenWedge,
}) => {
  const navigate = useNavigate();
  const [analysisSub, setAnalysisSub] = useState<AnalysisSub>(null);
  const [engagementSub, setEngagementSub] = useState<EngagementSub>(null);
  const [growNetworkScrollFromEvent, setGrowNetworkScrollFromEvent] = useState<
    GrowNetworkScrollTarget | undefined
  >();
  const [remarkSub, setRemarkSub] = useState<RemarkSub>(null);
  const [publishSub, setPublishSub] = useState<PublishSub>(null);

  const { connected } = useLinkedInSocialConnection();
  const { notifyRequested, handleNotify } = useCreateWedgeNotify();
  const {
    notifyRequested: publishNotifyRequested,
    handleNotify: handlePublishNotify,
  } = usePublishWedgeNotify();
  const {
    notifyRequested: analysisNotifyRequested,
    handleNotify: handleAnalysisNotify,
  } = useAnalysisWedgeNotify();

  // ── shared dispatchers ─────────────────────────────────────────────────────
  const dispatch = (evt: string, detail?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent(evt, detail ? { detail } : undefined));
  };

  const openTopicIdeas = () => {
    onClose();
    if (connected) {
      dispatch("linkedinwriter:getTopicIdeas");
    } else {
      dispatch("linkedinwriter:openBrainstorm");
    }
  };
  const openQuickCreate = (type: string) => {
    onClose();
    const detail: Record<string, unknown> = { type };
    try {
      const ctx = sessionStorage.getItem("growth_task_context");
      if (ctx) {
        const parsed = JSON.parse(ctx);
        if (parsed.pillar === "create" && parsed.title)
          detail.topic = parsed.title;
        sessionStorage.removeItem("growth_task_context");
      }
    } catch {
      /* ignore */
    }
    dispatch("linkedinwriter:openQuickCreate", detail);
  };
  const openProfileAnalytics = () => {
    onClose();
    dispatch("linkedinwriter:openOptimiseProfile");
  };
  const openContentAnalytics = () => {
    onClose();
    openPostAnalyticsModal({ fromAnalysisWedge: true });
  };
  const openSeoAnalytics = () => {
    onClose();
    navigate("/seo-dashboard");
  };
  const openGrowthEngine = () => {
    onClose();
    openGrowthEngineModal({ fromEngagementWedge: true });
  };

  useEffect(() => {
    const onOpenGrowNetwork = (event: Event) => {
      const detail = (event as CustomEvent<OpenGrowNetworkDetail>).detail;
      setEngagementSub("grow_network");
      setGrowNetworkScrollFromEvent(detail?.scrollToSection);
    };
    window.addEventListener(OPEN_GROW_NETWORK_EVENT, onOpenGrowNetwork);
    return () =>
      window.removeEventListener(OPEN_GROW_NETWORK_EVENT, onOpenGrowNetwork);
  }, []);

  useEffect(() => {
    const onOpenWorkflowWedge = (event: Event) => {
      const raw = (event as CustomEvent<OpenWorkflowWedgeDetailInput>).detail;
      if (!raw?.wedge) return;
      const detail = resolveWorkflowWedgeDetail(raw);
      onOpenWedge?.(detail.wedge);
      if (detail.wedge === "remarket" && detail.sub) {
        setRemarkSub(detail.sub as RemarkSub);
      }
      if (detail.wedge === "engagement" && detail.sub) {
        setEngagementSub(detail.sub as EngagementSub);
      }
    };
    window.addEventListener(OPEN_WORKFLOW_WEDGE_EVENT, onOpenWorkflowWedge);
    return () =>
      window.removeEventListener(
        OPEN_WORKFLOW_WEDGE_EVENT,
        onOpenWorkflowWedge,
      );
  }, [onOpenWedge]);

  const backToEngagementGrid = () => {
    setEngagementSub(null);
    onOpenWedge?.("engagement");
  };

  const backToPublishGrid = () => {
    setPublishSub(null);
    onOpenWedge?.("publish");
  };

  const backToAnalysisGrid = () => {
    setAnalysisSub(null);
    onOpenWedge?.("analysis");
  };

  const backToRemarketGrid = () => {
    setRemarkSub(null);
    onOpenWedge?.("remarket");
  };

  const growNetworkOpen =
    engagementSub === "grow_network" ||
    engagementSub === "network" ||
    engagementSub === "pymk";

  const engagementDrillDownOpen = engagementSub !== null;
  const publishDrillDownOpen = publishSub !== null;
  const analysisDrillDownOpen = analysisSub !== null;
  const remarkDrillDownOpen = remarkSub !== null;

  const growNetworkScrollTarget: GrowNetworkScrollTarget | undefined =
    growNetworkScrollFromEvent ??
    (engagementSub === "pymk"
      ? "live-linkedin"
      : engagementSub === "network"
        ? "ai-advisor"
        : undefined);

  const closeGrowNetwork = () => {
    setEngagementSub(null);
    setGrowNetworkScrollFromEvent(undefined);
  };

  return (
    <>
      {/* ── Plan ── */}
      <PlanWedgeModal open={activeModal === "plan"} onClose={onClose} />

      {/* ── Create ── */}
      <DashboardActionModal
        open={activeModal === "create"}
        title="Quick Create"
        onClose={onClose}
        maxWidth={820}
        modalClassName="linkedin-create-wedge-modal"
        titleSize="xl"
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "stretch",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <div style={{ width: 140, flexShrink: 0 }}>
            <DashboardToolTile
              title="Get Topic Ideas"
              description="AI-powered topic suggestions based on your profile"
              icon="💡"
              accent="#0a66c2"
              onClick={openTopicIdeas}
            />
          </div>
          {CREATE_TILE_TOOLS.map((tool) => (
            <div key={tool.id} style={{ width: 140, flexShrink: 0 }}>
              {isCreateWedgeContentTypeLocked(tool.id) ? (
                <CreateWedgeComingSoonTile
                  contentType={tool.id as CreateWedgeLockedContentType}
                  icon={tool.icon}
                  title={tool.title}
                  description={tool.description}
                  notified={notifyRequested[tool.id as CreateWedgeLockedContentType]}
                  onNotify={() =>
                    handleNotify(
                      tool.id as CreateWedgeLockedContentType,
                      tool.title,
                    )
                  }
                />
              ) : (
                <DashboardToolTile
                  title={tool.title}
                  description={tool.description}
                  icon={tool.icon}
                  accent={tool.accent}
                  onClick={() => openQuickCreate(tool.id)}
                />
              )}
            </div>
          ))}
        </div>
      </DashboardActionModal>

      {/* ── Publish ── */}
      <DashboardActionModal
        open={activeModal === "publish" && !publishDrillDownOpen}
        title="Publish"
        onClose={onClose}
        maxWidth={720}
        titleSize="xl"
        modalClassName="linkedin-publish-wedge-modal"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
          className="linkedin-publish-wedge-tiles"
        >
          <DashboardToolTile
            title="My Drafts"
            description="Browse your last 5 saved drafts. Open in Studio, run a quality check, or find the best time."
            icon="📁"
            accent="#0a66c2"
            onClick={() => {
              onClose();
              setPublishSub("drafts");
            }}
          />
          {isPublishWedgeFeatureLocked("publish_campaign") ? (
            <PublishWedgeComingSoonTile
              feature="publish_campaign"
              icon="📊"
              title="Publish Campaign"
              description="See scheduled posts ranked by ROI — with actionable insights for your week."
              notified={publishNotifyRequested.publish_campaign}
              onNotify={() =>
                handlePublishNotify("publish_campaign", "Publish Campaign")
              }
            />
          ) : (
            <DashboardToolTile
              title="Publish Campaign"
              description="See scheduled posts ranked by ROI — with actionable insights for your week."
              icon="📊"
              accent="#0ea5e9"
              onClick={() => {
                onClose();
                setPublishSub("drafts");
              }}
            />
          )}
        </div>
      </DashboardActionModal>

      {/* ── Publish sub-modals ── */}
      <DraftLibraryModal
        open={publishSub === "drafts"}
        onClose={() => setPublishSub(null)}
        onBack={backToPublishGrid}
      />

      {/* ── Analysis ── */}
      <DashboardActionModal
        open={activeModal === "analysis" && !analysisDrillDownOpen}
        title="Analysis"
        onClose={onClose}
        maxWidth={720}
        titleSize="xl"
        modalClassName="linkedin-analysis-wedge-modal"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
          className="linkedin-analysis-wedge-tiles"
        >
          <DashboardToolTile
            title="Content Analytics"
            description="Post performance, engagement trends, and growth engine"
            icon="📊"
            accent="#0ea5e9"
            onClick={openContentAnalytics}
          />
          <DashboardToolTile
            title="Profile Analytics"
            description="Profile strength, gaps, and optimisation"
            icon="👤"
            accent="#6366f1"
            onClick={openProfileAnalytics}
          />
          <DashboardToolTile
            title="Engagement since You joined ALwrity"
            description="Track growth since you joined — Top, Rising, and Falling posts"
            icon="📈"
            accent="#16a34a"
            onClick={() => {
              onClose();
              setAnalysisSub("trends");
            }}
          />
          {isAnalysisWedgeFeatureLocked("seo_analytics") ? (
            <AnalysisWedgeComingSoonTile
              feature="seo_analytics"
              icon="🔎"
              title="SEO Analytics"
              description="See how your LinkedIn content ranks in search"
              notified={analysisNotifyRequested.seo_analytics}
              onNotify={() =>
                handleAnalysisNotify("seo_analytics", "SEO Analytics")
              }
            />
          ) : (
            <DashboardToolTile
              title="SEO Analytics"
              description="See how your LinkedIn content ranks in search"
              icon="🔎"
              accent="#475569"
              onClick={openSeoAnalytics}
            />
          )}
        </div>
      </DashboardActionModal>

      <EngagementTrendsModal
        open={analysisSub === "trends"}
        onClose={() => setAnalysisSub(null)}
        onBack={backToAnalysisGrid}
        connected={connected}
      />

      {/* ── Engagement ── */}
      <DashboardActionModal
        open={activeModal === "engagement" && !engagementDrillDownOpen}
        title="Engagement"
        onClose={onClose}
        maxWidth={680}
        titleSize="xl"
        modalClassName="linkedin-engagement-wedge-modal"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <DashboardToolTile
            title="Comment Assistant"
            description="Draft the perfect reply with ALwrity to any comment, in your voice"
            icon="💬"
            accent="#0a66c2"
            onClick={() => {
              onClose();
              setEngagementSub("comment");
            }}
          />
          <DashboardToolTile
            title="Opportunities"
            description="Top 3 AI-identified conversations to engage with now"
            icon="🎯"
            accent="#059669"
            onClick={() => {
              onClose();
              setEngagementSub("opportunities");
            }}
          />
          <DashboardToolTile
            title={GROW_NETWORK_TILE.title}
            description={GROW_NETWORK_TILE.description}
            icon={GROW_NETWORK_TILE.icon}
            accent={GROW_NETWORK_TILE.accent}
            onClick={() => {
              onClose();
              setEngagementSub("grow_network");
            }}
          />
          <DashboardToolTile
            title="Growth Engine"
            description="Full growth engine with all 7 AI-powered insight cards"
            icon="🚀"
            accent="#6366f1"
            onClick={openGrowthEngine}
          />
        </div>
      </DashboardActionModal>

      <CommentAssistantModal
        open={engagementSub === "comment"}
        onClose={() => setEngagementSub(null)}
        onBack={backToEngagementGrid}
        connected={connected}
      />
      <OpportunitiesModal
        open={engagementSub === "opportunities"}
        onClose={() => setEngagementSub(null)}
        onBack={backToEngagementGrid}
        connected={connected}
      />
      <GrowNetworkModal
        open={growNetworkOpen}
        onClose={closeGrowNetwork}
        onBack={backToEngagementGrid}
        connected={connected}
        scrollToSection={growNetworkScrollTarget}
      />

      {/* ── Remarket ── */}
      <DashboardActionModal
        open={activeModal === "remarket" && !remarkDrillDownOpen}
        title="Remarket"
        onClose={onClose}
        maxWidth={680}
        titleSize="xl"
        modalClassName="linkedin-remarket-wedge-modal"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <DashboardToolTile
            title={PERFORMANCE_PULSE_TILE.title}
            description={getPerformancePulseTileDescription(connected)}
            icon={PERFORMANCE_PULSE_TILE.icon}
            accent={PERFORMANCE_PULSE_TILE.accent}
            disabled={!connected}
            disabledReason={PERFORMANCE_PULSE_TILE.disabledReason}
            onClick={() => {
              onClose();
              setRemarkSub("pulse");
            }}
          />
          <DashboardToolTile
            title="Repurpose Lab"
            description="Top 3 posts by engagement — instantly repurpose into any format"
            icon="♻️"
            accent="#f59e0b"
            onClick={() => {
              onClose();
              setRemarkSub("repurpose");
            }}
          />
          <DashboardToolTile
            title="Format Transformer"
            description="Turn your current draft into an Article, Carousel, or Video Script"
            icon="🔄"
            accent="#8b5cf6"
            onClick={() => {
              onClose();
              setRemarkSub("transformer");
            }}
          />
          <DashboardToolTile
            title="Content Refresh"
            description="Apply 7 AI transforms to any of your recent posts in one click"
            icon="✨"
            accent="#059669"
            onClick={() => {
              onClose();
              setRemarkSub("refresh");
            }}
          />
          <DashboardToolTile
            title="Stale Reviver"
            description="Buried high-performing gems — expand, optimise & repost"
            icon="🌱"
            accent="#dc2626"
            onClick={() => {
              onClose();
              setRemarkSub("reviver");
            }}
          />
          <DashboardToolTile
            title="Perf → Plan"
            description="Extract winning topics from top posts, generate 5 remix ideas"
            icon="📈"
            accent="#0a66c2"
            onClick={() => {
              onClose();
              setRemarkSub("perf_plan");
            }}
          />
        </div>
      </DashboardActionModal>

      <PostPulseModal
        open={remarkSub === "pulse"}
        onClose={() => setRemarkSub(null)}
        onBack={backToRemarketGrid}
        connected={connected}
      />
      <RepurposeLabModal
        open={remarkSub === "repurpose"}
        onClose={() => setRemarkSub(null)}
        onBack={backToRemarketGrid}
      />
      <FormatTransformerModal
        open={remarkSub === "transformer"}
        onClose={() => setRemarkSub(null)}
        onBack={backToRemarketGrid}
      />
      <ContentRefreshModal
        open={remarkSub === "refresh"}
        onClose={() => setRemarkSub(null)}
        onBack={backToRemarketGrid}
      />
      <StaleReviverModal
        open={remarkSub === "reviver"}
        onClose={() => setRemarkSub(null)}
        onBack={backToRemarketGrid}
      />
      <PerfToPlanModal
        open={remarkSub === "perf_plan"}
        onClose={() => setRemarkSub(null)}
        onBack={backToRemarketGrid}
      />
    </>
  );
};

export function isWorkflowModalId(
  cardId: DashboardWorkflowCardId,
): cardId is WorkflowModalId {
  return [
    "plan",
    "create",
    "publish",
    "analysis",
    "engagement",
    "remarket",
  ].includes(cardId);
}
