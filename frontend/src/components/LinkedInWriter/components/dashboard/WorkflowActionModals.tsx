import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardActionModal } from './DashboardActionModal';
import { DashboardToolTile } from './DashboardToolTile';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import {
  GrowthSnapshotModal,
  PostTodayModal,
  BrandScorecardModal,
  WeeklyPlanModal,
  ViralCopywriterModal,
} from './AnalysisWedgeModals';
import {
  EngagementBoosterModal,
  CommentAssistantModal,
  OpportunitiesModal,
  PostPulseModal,
  NetworkAdvisorModal,
} from './EngagementWedgeModals';
import {
  DraftLibraryModal,
  QualityCheckModal,
  TimingAdvisorModal,
  ScheduleQuickModal,
  PublishNowModal,
} from './PublishWedgeModals';

type AnalysisSub = 'snapshot' | 'post_today' | 'brand_score' | 'weekly_plan' | 'viral' | null;
type EngagementSub = 'booster' | 'comment' | 'opportunities' | 'pulse' | 'network' | null;
type PublishSub = 'drafts' | 'quality' | 'timing' | 'schedule' | 'publish_now' | null;

export type WorkflowModalId = 'plan' | 'create' | 'publish' | 'analysis' | 'engagement';

interface WorkflowActionModalsProps {
  activeModal: WorkflowModalId | null;
  onClose: () => void;
  connected?: boolean;
}

const CONNECT_REQUIRED_REASON = 'Connect LinkedIn to use this feature';

const CREATE_TILE_TOOLS = [
  {
    id: 'post',
    title: 'Post',
    description: 'Professional LinkedIn post with engagement hooks',
    icon: '📝',
    accent: '#0a66c2',
  },
  {
    id: 'article',
    title: 'Article',
    description: 'Thought leadership article with in-depth analysis',
    icon: '📄',
    accent: '#057642',
  },
  {
    id: 'video_script',
    title: 'Video Script',
    description: 'Engaging video script with hook & scenes',
    icon: '🎬',
    accent: '#dc2626',
  },
  {
    id: 'carousel',
    title: 'Carousel',
    description: 'Multi-slide carousel for visual storytelling',
    icon: '🎠',
    accent: '#8b5cf6',
  },
];

export const WorkflowActionModals: React.FC<WorkflowActionModalsProps> = ({
  activeModal,
  onClose,
  connected = false,
}) => {
  const navigate = useNavigate();
  const [analysisSub, setAnalysisSub] = useState<AnalysisSub>(null);
  const [engagementSub, setEngagementSub] = useState<EngagementSub>(null);
  const [publishSub, setPublishSub] = useState<PublishSub>(null);

  const openBrainstorm = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('linkedinwriter:openBrainstorm'));
  };

  const openWatchdog = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('linkedinwriter:openWatchdog'));
  };

  const openQuickCreate = (type: string) => {
    onClose();
    window.dispatchEvent(
      new CustomEvent('linkedinwriter:openQuickCreate', { detail: { type } })
    );
  };

  const openTopicIdeas = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('linkedinwriter:getTopicIdeas'));
  };

  const openShareLink = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('linkedinwriter:openShareLink'));
  };

  const openCalendar = () => {
    onClose();
    navigate('/content-planning', { state: { activeTab: 1 } });
  };

  const openProfileAnalytics = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('linkedinwriter:openOptimiseProfile'));
  };

  const openContentAnalytics = () => {
    onClose();
    window.dispatchEvent(
      new CustomEvent('linkedinwriter:switchTab', { detail: { tab: 'analytics' } })
    );
  };

  const openSeoAnalytics = () => {
    onClose();
    navigate('/seo-dashboard');
  };

  const openGrowthEngine = () => {
    onClose();
    window.dispatchEvent(
      new CustomEvent('linkedinwriter:switchTab', { detail: { tab: 'growth' } })
    );
  };

  return (
    <>
      {/* ── Plan ── */}
      <DashboardActionModal open={activeModal === 'plan'} title="Plan" onClose={onClose} maxWidth={480}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <DashboardToolTile
            title="Brainstorm"
            description="Generate ideas with persona and web research"
            icon="🧠"
            accent="#6366f1"
            onClick={openBrainstorm}
          />
          <DashboardToolTile
            title="Watchdog"
            description="Industry watchdog — monitor trends and news"
            icon="🔍"
            accent="#0ea5e9"
            onClick={openWatchdog}
          />
        </div>
      </DashboardActionModal>

      {/* ── Create ── */}
      <DashboardActionModal open={activeModal === 'create'} title="Quick Create" onClose={onClose} maxWidth={820}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            gap: 12,
            justifyContent: 'center',
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
          <div style={{ width: 140, flexShrink: 0 }}>
            <DashboardToolTile
              title="Share a Link"
              description="Turn any URL into a LinkedIn post"
              icon="🔗"
              accent="#10b981"
              onClick={openShareLink}
            />
          </div>
          {CREATE_TILE_TOOLS.map((tool) => (
            <div key={tool.id} style={{ width: 140, flexShrink: 0 }}>
              <DashboardToolTile
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                accent={tool.accent}
                onClick={() => openQuickCreate(tool.id)}
              />
            </div>
          ))}
        </div>
      </DashboardActionModal>

      {/* ── Publish ── */}
      <DashboardActionModal open={activeModal === 'publish'} title="Publish" onClose={onClose} maxWidth={680}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="Draft Library"
            description="Open your saved LinkedIn posts and drafts"
            icon="📁"
            accent="#0a66c2"
            onClick={() => { onClose(); setPublishSub('drafts'); }}
          />
          <DashboardToolTile
            title="Quality Check"
            description="Pre-publish 6-dimension score card"
            icon="✅"
            accent="#10b981"
            onClick={() => { onClose(); setPublishSub('quality'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Timing Advisor"
            description="Optimal posting times week grid"
            icon="⏰"
            accent="#f59e0b"
            onClick={() => { onClose(); setPublishSub('timing'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Schedule"
            description="Quick-add to content calendar"
            icon="📅"
            accent="#0ea5e9"
            onClick={() => { onClose(); setPublishSub('schedule'); }}
          />
          <DashboardToolTile
            title="Publish Now"
            description="Direct LinkedIn publish with pre-flight"
            icon="🚀"
            accent="#dc2626"
            onClick={() => { onClose(); setPublishSub('publish_now'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Content Calendar"
            description="Content scheduled to be published"
            icon="📆"
            accent="#6366f1"
            onClick={openCalendar}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
        </div>
      </DashboardActionModal>

      {/* ── Analysis ── */}
      <DashboardActionModal open={activeModal === 'analysis'} title="Analysis" onClose={onClose} maxWidth={680}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="Growth Snapshot"
            description="Instant view: top trending topic, biggest content gap, brand score"
            icon="⚡"
            accent="#f59e0b"
            onClick={() => { onClose(); setAnalysisSub('snapshot'); }}
          />
          <DashboardToolTile
            title="Post Today"
            description="AI ranks your top 3 post opportunities right now"
            icon="🎯"
            accent="#0a66c2"
            onClick={() => { onClose(); setAnalysisSub('post_today'); }}
          />
          <DashboardToolTile
            title="Brand Score"
            description="Full personal brand breakdown across 5 dimensions"
            icon="🏆"
            accent="#8b5cf6"
            onClick={() => { onClose(); setAnalysisSub('brand_score'); }}
          />
          <DashboardToolTile
            title="Weekly Plan"
            description="Mon–Fri AI content plan with Create Now + Schedule CTAs"
            icon="📅"
            accent="#059669"
            onClick={() => { onClose(); setAnalysisSub('weekly_plan'); }}
          />
          <DashboardToolTile
            title="Viral Patterns"
            description="Top viral formats in your niche — write in any style"
            icon="🔥"
            accent="#dc2626"
            onClick={() => { onClose(); setAnalysisSub('viral'); }}
          />
          <DashboardToolTile
            title="Profile Analytics"
            description="Profile strength, gaps, and optimisation"
            icon="👤"
            accent="#6366f1"
            onClick={openProfileAnalytics}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Content Analytics"
            description="Post performance, engagement trends, and growth engine"
            icon="📊"
            accent="#0ea5e9"
            onClick={openContentAnalytics}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="SEO Analytics"
            description="See how your LinkedIn content ranks in search"
            icon="🔎"
            accent="#475569"
            onClick={openSeoAnalytics}
          />
        </div>
      </DashboardActionModal>

      {/* ── Engagement ── */}
      <DashboardActionModal open={activeModal === 'engagement'} title="Engagement" onClose={onClose} maxWidth={680}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="Engagement Booster"
            description="Optimize content rewrite with before/after preview score"
            icon="🚀"
            accent="#f59e0b"
            onClick={() => { onClose(); setEngagementSub('booster'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Comment Assistant"
            description="HITL comment reply drafter"
            icon="💬"
            accent="#0a66c2"
            onClick={() => { onClose(); setEngagementSub('comment'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Opportunities"
            description="Top 3 AI engagement opportunities from growth cache"
            icon="🎯"
            accent="#8b5cf6"
            onClick={() => { onClose(); setEngagementSub('opportunities'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Post Pulse"
            description="Real post metrics with repurpose CTAs"
            icon="📡"
            accent="#0ea5e9"
            onClick={() => { onClose(); setEngagementSub('pulse'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Network Advisor"
            description="Network suggestions with outreach drafts"
            icon="🤝"
            accent="#10b981"
            onClick={() => { onClose(); setEngagementSub('network'); }}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
          <DashboardToolTile
            title="Growth Engine"
            description="Boost interaction, expand reach, convert viewers"
            icon="📈"
            accent="#059669"
            onClick={openGrowthEngine}
          />
        </div>
      </DashboardActionModal>

      {/* ── Analysis sub-modals ── */}
      <GrowthSnapshotModal open={analysisSub === 'snapshot'} onClose={() => setAnalysisSub(null)} />
      <PostTodayModal open={analysisSub === 'post_today'} onClose={() => setAnalysisSub(null)} />
      <BrandScorecardModal open={analysisSub === 'brand_score'} onClose={() => setAnalysisSub(null)} />
      <WeeklyPlanModal open={analysisSub === 'weekly_plan'} onClose={() => setAnalysisSub(null)} />
      <ViralCopywriterModal open={analysisSub === 'viral'} onClose={() => setAnalysisSub(null)} />

      {/* ── Engagement sub-modals ── */}
      <EngagementBoosterModal open={engagementSub === 'booster'} onClose={() => setEngagementSub(null)} />
      <CommentAssistantModal open={engagementSub === 'comment'} onClose={() => setEngagementSub(null)} />
      <OpportunitiesModal open={engagementSub === 'opportunities'} onClose={() => setEngagementSub(null)} />
      <PostPulseModal open={engagementSub === 'pulse'} onClose={() => setEngagementSub(null)} />
      <NetworkAdvisorModal open={engagementSub === 'network'} onClose={() => setEngagementSub(null)} />

      {/* ── Publish sub-modals ── */}
      <DraftLibraryModal open={publishSub === 'drafts'} onClose={() => setPublishSub(null)} />
      <QualityCheckModal open={publishSub === 'quality'} onClose={() => setPublishSub(null)} />
      <TimingAdvisorModal
        open={publishSub === 'timing'}
        onClose={() => setPublishSub(null)}
        onScheduleSlot={() => setPublishSub('schedule')}
      />
      <ScheduleQuickModal open={publishSub === 'schedule'} onClose={() => setPublishSub(null)} />
      <PublishNowModal open={publishSub === 'publish_now'} onClose={() => setPublishSub(null)} />
    </>
  );
};

export function isWorkflowModalId(cardId: DashboardWorkflowCardId): cardId is WorkflowModalId {
  return cardId === 'plan' || cardId === 'create' || cardId === 'publish' || cardId === 'analysis' || cardId === 'engagement';
}
