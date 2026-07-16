import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardActionModal } from './DashboardActionModal';
import { DashboardToolTile } from './DashboardToolTile';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import { PlanWedgeModal } from '../Brainstorm/PlanWedgeModal';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import {
  openGrowthEngineModal,
  openPostAnalyticsModal,
} from '../../utils/linkedInDashboardEvents';
import {
  GrowthSnapshotModal,
  PostTodayModal,
  BrandScorecardModal,
  WeeklyPlanModal,
  ViralCopywriterModal,
  EngagementTrendsModal,
} from './analysisWedgeModalExports';
import {
  EngagementBoosterModal,
  CommentAssistantModal,
  OpportunitiesModal,
  PostPulseModal,
  NetworkAdvisorModal,
} from './EngagementWedgeModals';
import {
  RepurposeLabModal,
  FormatTransformerModal,
  ContentRefreshModal,
  StaleReviverModal,
  PerfToPlanModal,
} from './RemarkWedgeModals';
import {
  DraftLibraryModal,
  PublishNowModal,
} from './PublishWedgeModals';
import { PeopleYouMayKnowModal } from '../PeopleYouMayKnow/PeopleYouMayKnowModal';

type PlanSub = 'weekly_plan' | null;
type AnalysisSub = 'snapshot' | 'brand_score' | 'viral' | 'trends' | null;
type EngagementSub = 'booster' | 'comment' | 'opportunities' | 'pulse' | 'network' | 'pymk' | null;
type RemarkSub = 'repurpose' | 'transformer' | 'refresh' | 'reviver' | 'perf_plan' | null;
type PublishSub = 'drafts' | 'post_today' | 'publish_now' | null;

export type WorkflowModalId = 'plan' | 'create' | 'publish' | 'analysis' | 'engagement' | 'remarket';

interface WorkflowActionModalsProps {
  activeModal: WorkflowModalId | null;
  onClose: () => void;
}

const CREATE_TILE_TOOLS = [
  { id: 'post',         title: 'Post',         description: 'Professional LinkedIn post with engagement hooks',    icon: '📝', accent: '#0a66c2' },
  { id: 'article',      title: 'Article',       description: 'Thought leadership article with in-depth analysis',  icon: '📄', accent: '#057642' },
  { id: 'video_script', title: 'Video Script',  description: 'Engaging video script with hook & scenes',          icon: '🎬', accent: '#dc2626' },
  { id: 'carousel',     title: 'Carousel',      description: 'Multi-slide carousel for visual storytelling',       icon: '🎠', accent: '#8b5cf6' },
];

export const WorkflowActionModals: React.FC<WorkflowActionModalsProps> = ({
  activeModal,
  onClose,
}) => {
  const navigate = useNavigate();
  const [planSub, setPlanSub]             = useState<PlanSub>(null);
  const [analysisSub, setAnalysisSub]     = useState<AnalysisSub>(null);
  const [engagementSub, setEngagementSub] = useState<EngagementSub>(null);
  const [remarkSub, setRemarkSub]         = useState<RemarkSub>(null);
  const [publishSub, setPublishSub] = useState<PublishSub>(null);

  const { connected } = useLinkedInSocialConnection();

  // ── shared dispatchers ─────────────────────────────────────────────────────
  const dispatch = (evt: string, detail?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent(evt, detail ? { detail } : undefined));
  };

  const openWatchdog        = () => { onClose(); dispatch('linkedinwriter:openWatchdog'); };
  const openTopicIdeas      = () => { onClose(); dispatch('linkedinwriter:getTopicIdeas'); };
  const openQuickCreate     = (type: string) => {
    onClose();
    const detail: Record<string, unknown> = { type };
    try {
      const ctx = sessionStorage.getItem('growth_task_context');
      if (ctx) {
        const parsed = JSON.parse(ctx);
        if (parsed.pillar === 'create' && parsed.title) detail.topic = parsed.title;
        sessionStorage.removeItem('growth_task_context');
      }
    } catch { /* ignore */ }
    dispatch('linkedinwriter:openQuickCreate', detail);
  };
  const openProfileAnalytics = () => { onClose(); dispatch('linkedinwriter:openOptimiseProfile'); };
  const openContentAnalytics = () => { onClose(); openPostAnalyticsModal(); };
  const openSeoAnalytics    = () => { onClose(); navigate('/seo-dashboard'); };
  const openGrowthEngine    = () => { onClose(); openGrowthEngineModal(); };

  return (
    <>
      {/* ── Plan ── */}
      <PlanWedgeModal
        open={activeModal === 'plan'}
        onClose={onClose}
        onOpenWatchdog={openWatchdog}
        onOpenWeeklyPlan={() => { onClose(); setPlanSub('weekly_plan'); }}
      />

      {/* ── Plan sub-modals ── */}
      <WeeklyPlanModal open={planSub === 'weekly_plan'} onClose={() => setPlanSub(null)} />

      {/* ── Create ── */}
      <DashboardActionModal open={activeModal === 'create'} title="Quick Create" onClose={onClose} maxWidth={820}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 12, justifyContent: 'center' }}>
          <div style={{ width: 140, flexShrink: 0 }}>
            <DashboardToolTile title="Get Topic Ideas" description="AI-powered topic suggestions based on your profile" icon="💡" accent="#0a66c2" onClick={openTopicIdeas} />
          </div>
          {CREATE_TILE_TOOLS.map(tool => (
            <div key={tool.id} style={{ width: 140, flexShrink: 0 }}>
              <DashboardToolTile title={tool.title} description={tool.description} icon={tool.icon} accent={tool.accent} onClick={() => openQuickCreate(tool.id)} />
            </div>
          ))}
        </div>
      </DashboardActionModal>

      {/* ── Publish ── */}
      <DashboardActionModal open={activeModal === 'publish'} title="Publish" onClose={onClose} maxWidth={640}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="My Drafts"
            description="Browse and restore your saved LinkedIn posts"
            icon="📁"
            accent="#0a66c2"
            onClick={() => { onClose(); setPublishSub('drafts'); }}
          />
          <DashboardToolTile
            title="Post Today"
            description="AI ranks your top 3 post opportunities right now"
            icon="🎯"
            accent="#0a66c2"
            onClick={() => { onClose(); setPublishSub('post_today'); }}
          />
          <DashboardToolTile
            title="Publish to LinkedIn"
            description="Publish your draft directly with a 3-step pre-flight check"
            icon="🚀"
            accent="#dc2626"
            onClick={() => { onClose(); setPublishSub('publish_now'); }}
          />
        </div>
      </DashboardActionModal>

      {/* ── Publish sub-modals ── */}
      <DraftLibraryModal open={publishSub === 'drafts'} onClose={() => setPublishSub(null)} />
      <PostTodayModal open={publishSub === 'post_today'} onClose={() => setPublishSub(null)} />
      <PublishNowModal open={publishSub === 'publish_now'} onClose={() => setPublishSub(null)} />

      {/* ── Analysis ── */}
      <DashboardActionModal open={activeModal === 'analysis'} title="Analysis" onClose={onClose} maxWidth={720}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <DashboardToolTile title="Growth Snapshot" description="Instant view: top trending topic, biggest content gap, brand score" icon="⚡" accent="#f59e0b" onClick={() => { onClose(); setAnalysisSub('snapshot'); }} />
          <DashboardToolTile title="Brand Score"     description="Full personal brand breakdown across 5 dimensions"                  icon="🏆" accent="#8b5cf6" onClick={() => { onClose(); setAnalysisSub('brand_score'); }} />
          <DashboardToolTile title="Viral Patterns"     description="Top viral formats in your niche — write in any style"               icon="🔥" accent="#dc2626" onClick={() => { onClose(); setAnalysisSub('viral'); }} />
          <DashboardToolTile title="Engagement Trends" description="See how your posts perform over time — track growth, spot declines" icon="📈" accent="#16a34a" onClick={() => { onClose(); setAnalysisSub('trends'); }} />
          <DashboardToolTile title="Profile Analytics"  description="Profile strength, gaps, and optimisation"                       icon="👤" accent="#6366f1" onClick={openProfileAnalytics} />
          <DashboardToolTile title="Content Analytics"  description="Post performance, engagement trends, and growth engine"          icon="📊" accent="#0ea5e9" onClick={openContentAnalytics} />
          <DashboardToolTile title="SEO Analytics"      description="See how your LinkedIn content ranks in search"                   icon="🔎" accent="#475569" onClick={openSeoAnalytics} />
        </div>
      </DashboardActionModal>

      <GrowthSnapshotModal  open={analysisSub === 'snapshot'}    onClose={() => setAnalysisSub(null)} />
      <BrandScorecardModal  open={analysisSub === 'brand_score'} onClose={() => setAnalysisSub(null)} />
      <ViralCopywriterModal  open={analysisSub === 'viral'}       onClose={() => setAnalysisSub(null)} />
      <EngagementTrendsModal open={analysisSub === 'trends'}      onClose={() => setAnalysisSub(null)} connected={connected} />

      {/* ── Engagement ── */}
      <DashboardActionModal open={activeModal === 'engagement'} title="Engagement" onClose={onClose} maxWidth={680}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="Engagement Booster"
            description="AI rewrites your draft for maximum engagement — shows before/after score"
            icon="⚡"
            accent="#f59e0b"
            onClick={() => { onClose(); setEngagementSub('booster'); }}
          />
          <DashboardToolTile
            title="Comment Assistant"
            description="Draft the perfect AI reply to any comment, in your voice"
            icon="💬"
            accent="#0a66c2"
            onClick={() => { onClose(); setEngagementSub('comment'); }}
          />
          <DashboardToolTile
            title="Opportunities"
            description="Top 3 AI-identified conversations to engage with now"
            icon="🎯"
            accent="#059669"
            onClick={() => { onClose(); setEngagementSub('opportunities'); }}
          />
          <DashboardToolTile
            title="Post Pulse"
            description={connected ? "Real engagement metrics — repurpose winners, boost underperformers" : "Connect LinkedIn to view your post engagement metrics"}
            icon="📊"
            accent="#8b5cf6"
            disabled={!connected}
            disabledReason="Connect your LinkedIn account to view post engagement metrics"
            onClick={() => { onClose(); setEngagementSub('pulse'); }}
          />
          <DashboardToolTile
            title="Network Advisor"
            description="AI-suggested connections with personalised outreach notes"
            icon="🤝"
            accent="#dc2626"
            onClick={() => { onClose(); setEngagementSub('network'); }}
          />
          <DashboardToolTile
            title="People You May Know"
            description="Live LinkedIn network suggestions — discover connections in your industry"
            icon="👥"
            accent="#10b981"
            onClick={() => { onClose(); setEngagementSub('pymk'); }}
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

      <EngagementBoosterModal open={engagementSub === 'booster'}       onClose={() => setEngagementSub(null)} connected={connected} />
      <CommentAssistantModal  open={engagementSub === 'comment'}       onClose={() => setEngagementSub(null)} />
      <OpportunitiesModal     open={engagementSub === 'opportunities'} onClose={() => setEngagementSub(null)} connected={connected} />
      <PostPulseModal         open={engagementSub === 'pulse'}         onClose={() => setEngagementSub(null)} connected={connected} />
      <NetworkAdvisorModal    open={engagementSub === 'network'}       onClose={() => setEngagementSub(null)} connected={connected} />
      <PeopleYouMayKnowModal open={engagementSub === 'pymk'} onClose={() => setEngagementSub(null)} />

      {/* ── Remarket ── */}
      <DashboardActionModal open={activeModal === 'remarket'} title="Remarket" onClose={onClose} maxWidth={680}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="Repurpose Lab"
            description="Top 3 posts by engagement — instantly repurpose into any format"
            icon="♻️"
            accent="#f59e0b"
            onClick={() => { onClose(); setRemarkSub('repurpose'); }}
          />
          <DashboardToolTile
            title="Format Transformer"
            description="Turn your current draft into an Article, Carousel, or Video Script"
            icon="🔄"
            accent="#8b5cf6"
            onClick={() => { onClose(); setRemarkSub('transformer'); }}
          />
          <DashboardToolTile
            title="Content Refresh"
            description="Apply 7 AI transforms to any of your recent posts in one click"
            icon="✨"
            accent="#059669"
            onClick={() => { onClose(); setRemarkSub('refresh'); }}
          />
          <DashboardToolTile
            title="Stale Reviver"
            description="Buried high-performing gems — expand, optimise & repost"
            icon="🌱"
            accent="#dc2626"
            onClick={() => { onClose(); setRemarkSub('reviver'); }}
          />
          <DashboardToolTile
            title="Perf → Plan"
            description="Extract winning topics from top posts, generate 5 remix ideas"
            icon="📈"
            accent="#0a66c2"
            onClick={() => { onClose(); setRemarkSub('perf_plan'); }}
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

      <RepurposeLabModal     open={remarkSub === 'repurpose'}   onClose={() => setRemarkSub(null)} />
      <FormatTransformerModal open={remarkSub === 'transformer'} onClose={() => setRemarkSub(null)} />
      <ContentRefreshModal   open={remarkSub === 'refresh'}     onClose={() => setRemarkSub(null)} />
      <StaleReviverModal     open={remarkSub === 'reviver'}     onClose={() => setRemarkSub(null)} />
      <PerfToPlanModal       open={remarkSub === 'perf_plan'}   onClose={() => setRemarkSub(null)} />
    </>
  );
};

export function isWorkflowModalId(cardId: DashboardWorkflowCardId): cardId is WorkflowModalId {
  return ['plan', 'create', 'publish', 'analysis', 'engagement', 'remarket'].includes(cardId);
}
