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

type AnalysisSub = 'snapshot' | 'post_today' | 'brand_score' | 'weekly_plan' | 'viral' | null;

export type WorkflowModalId = 'plan' | 'create' | 'publish' | 'analysis';

interface WorkflowActionModalsProps {
  activeModal: WorkflowModalId | null;
  onClose: () => void;
}

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
}) => {
  const navigate = useNavigate();
  const [analysisSub, setAnalysisSub] = useState<AnalysisSub>(null);

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

  const openDrafts = () => {
    onClose();
    navigate('/asset-library?source_module=linkedin_writer');
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

  return (
    <>
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

      <DashboardActionModal open={activeModal === 'publish'} title="Publish" onClose={onClose} maxWidth={520}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="Draft"
            description="Open your saved LinkedIn posts and drafts"
            icon="📁"
            accent="#0a66c2"
            onClick={openDrafts}
          />
          <DashboardToolTile
            title="Content Calendar"
            description="Content scheduled to be published"
            icon="📅"
            accent="#10b981"
            onClick={openCalendar}
          />
        </div>
      </DashboardActionModal>

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
          />
          <DashboardToolTile
            title="Content Analytics"
            description="Post performance, engagement trends, and growth engine"
            icon="📊"
            accent="#0ea5e9"
            onClick={openContentAnalytics}
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

      <GrowthSnapshotModal open={analysisSub === 'snapshot'} onClose={() => setAnalysisSub(null)} />
      <PostTodayModal open={analysisSub === 'post_today'} onClose={() => setAnalysisSub(null)} />
      <BrandScorecardModal open={analysisSub === 'brand_score'} onClose={() => setAnalysisSub(null)} />
      <WeeklyPlanModal open={analysisSub === 'weekly_plan'} onClose={() => setAnalysisSub(null)} />
      <ViralCopywriterModal open={analysisSub === 'viral'} onClose={() => setAnalysisSub(null)} />
    </>
  );
};

export function isWorkflowModalId(cardId: DashboardWorkflowCardId): cardId is WorkflowModalId {
  return cardId === 'plan' || cardId === 'create' || cardId === 'publish' || cardId === 'analysis';
}
