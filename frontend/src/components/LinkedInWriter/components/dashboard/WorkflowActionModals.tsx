import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardActionModal } from "./DashboardActionModal";
import { DashboardToolTile } from "./DashboardToolTile";
import type { DashboardWorkflowCardId } from "./dashboardWorkflowConfig";
import { PlanWedgeModal } from "../Brainstorm/PlanWedgeModal";
import { useLinkedInSocialConnection } from "../../../../hooks/useLinkedInSocialConnection";
import {
  openGrowthEngineModal,
  openPostAnalyticsModal,
} from "../../utils/linkedInDashboardEvents";
import {
  EngagementTrendsModal,
} from "./analysisWedgeModalExports";
import {
  EngagementBoosterModal,
  CommentAssistantModal,
  OpportunitiesModal,
  PostPulseModal,
  NetworkAdvisorModal,
} from "./EngagementWedgeModals";
import {
  RepurposeLabModal,
  FormatTransformerModal,
  ContentRefreshModal,
  StaleReviverModal,
  PerfToPlanModal,
} from "./RemarkWedgeModals";
import { DraftLibraryModal } from "./PublishWedgeModals";
import { PeopleYouMayKnowModal } from "../PeopleYouMayKnow";
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
  "booster" | "comment" | "opportunities" | "pulse" | "network" | "pymk" | null;
type RemarkSub =
  "repurpose" | "transformer" | "refresh" | "reviver" | "perf_plan" | null;
type PublishSub = "drafts" | null;

export type WorkflowModalId =
  "plan" | "create" | "publish" | "analysis" | "engagement" | "remarket";

interface WorkflowActionModalsProps {
  activeModal: WorkflowModalId | null;
  onClose: () => void;
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
}) => {
  const navigate = useNavigate();
  const [analysisSub, setAnalysisSub] = useState<AnalysisSub>(null);
  const [engagementSub, setEngagementSub] = useState<EngagementSub>(null);
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
    openPostAnalyticsModal();
  };
  const openSeoAnalytics = () => {
    onClose();
    navigate("/seo-dashboard");
  };
  const openGrowthEngine = () => {
    onClose();
    openGrowthEngineModal();
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
        open={activeModal === "publish"}
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
      />

      {/* ── Analysis ── */}
      <DashboardActionModal
        open={activeModal === "analysis"}
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
        connected={connected}
      />

      {/* ── Engagement ── */}
      <DashboardActionModal
        open={activeModal === "engagement"}
        title="Engagement"
        onClose={onClose}
        maxWidth={680}
        titleSize="xl"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <DashboardToolTile
            title="Engagement Booster"
            description="AI rewrites your draft for maximum engagement — shows before/after score"
            icon="⚡"
            accent="#f59e0b"
            onClick={() => {
              onClose();
              setEngagementSub("booster");
            }}
          />
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
            title="Post Pulse"
            description={
              connected
                ? "Real engagement metrics — repurpose winners, boost underperformers"
                : "Connect LinkedIn to view your post engagement metrics"
            }
            icon="📊"
            accent="#8b5cf6"
            disabled={!connected}
            disabledReason="Connect your LinkedIn account to view post engagement metrics"
            onClick={() => {
              onClose();
              setEngagementSub("pulse");
            }}
          />
          <DashboardToolTile
            title="Network Advisor"
            description="AI-suggested connections with personalised outreach notes"
            icon="🤝"
            accent="#dc2626"
            onClick={() => {
              onClose();
              setEngagementSub("network");
            }}
          />
          <DashboardToolTile
            title="People You May Know"
            description="Live LinkedIn network suggestions — discover connections in your industry"
            icon="👥"
            accent="#10b981"
            onClick={() => {
              onClose();
              setEngagementSub("pymk");
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

      <EngagementBoosterModal
        open={engagementSub === "booster"}
        onClose={() => setEngagementSub(null)}
        connected={connected}
      />
      <CommentAssistantModal
        open={engagementSub === "comment"}
        onClose={() => setEngagementSub(null)}
        connected={connected}
      />
      <OpportunitiesModal
        open={engagementSub === "opportunities"}
        onClose={() => setEngagementSub(null)}
        connected={connected}
      />
      <PostPulseModal
        open={engagementSub === "pulse"}
        onClose={() => setEngagementSub(null)}
        connected={connected}
      />
      <NetworkAdvisorModal
        open={engagementSub === "network"}
        onClose={() => setEngagementSub(null)}
        connected={connected}
      />
      <PeopleYouMayKnowModal
        open={engagementSub === "pymk"}
        onClose={() => setEngagementSub(null)}
      />

      {/* ── Remarket ── */}
      <DashboardActionModal
        open={activeModal === "remarket"}
        title="Remarket"
        onClose={onClose}
        maxWidth={680}
        titleSize="xl"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
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
          <DashboardToolTile
            title="Post Analytics"
            description="Full post performance dashboard with engagement breakdown"
            icon="📊"
            accent="#6366f1"
            onClick={openContentAnalytics}
          />
        </div>
      </DashboardActionModal>

      <RepurposeLabModal
        open={remarkSub === "repurpose"}
        onClose={() => setRemarkSub(null)}
      />
      <FormatTransformerModal
        open={remarkSub === "transformer"}
        onClose={() => setRemarkSub(null)}
      />
      <ContentRefreshModal
        open={remarkSub === "refresh"}
        onClose={() => setRemarkSub(null)}
      />
      <StaleReviverModal
        open={remarkSub === "reviver"}
        onClose={() => setRemarkSub(null)}
      />
      <PerfToPlanModal
        open={remarkSub === "perf_plan"}
        onClose={() => setRemarkSub(null)}
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
