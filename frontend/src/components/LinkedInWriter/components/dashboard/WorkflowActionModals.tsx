import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardActionModal } from './DashboardActionModal';
import { DashboardToolTile } from './DashboardToolTile';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import {
  DraftLibraryModal,
  QualityCheckModal,
  TimingAdvisorModal,
  ScheduleQuickModal,
  PublishNowModal,
} from './PublishWedgeModals';

type PublishSub = 'drafts' | 'quality' | 'timing' | 'schedule' | 'publish_now' | null;

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
  const [publishSub, setPublishSub] = useState<PublishSub>(null);
  const [timingPrefill, setTimingPrefill] = useState<{ date: string; time: string } | null>(null);

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
            title="Quality Check"
            description="Score your post across 6 dimensions before publishing"
            icon="📊"
            accent="#8b5cf6"
            onClick={() => { onClose(); setPublishSub('quality'); }}
          />
          <DashboardToolTile
            title="Best Time to Post"
            description="Industry-keyed optimal LinkedIn posting windows"
            icon="⏰"
            accent="#0ea5e9"
            onClick={() => { onClose(); setPublishSub('timing'); }}
          />
          <DashboardToolTile
            title="Schedule Post"
            description="Add to your content calendar without leaving the studio"
            icon="📅"
            accent="#10b981"
            onClick={() => { onClose(); setPublishSub('schedule'); }}
          />
          <DashboardToolTile
            title="Publish to LinkedIn"
            description="Publish your draft directly with a 3-step pre-flight check"
            icon="🚀"
            accent="#dc2626"
            onClick={() => { onClose(); setPublishSub('publish_now'); }}
          />
          <DashboardToolTile
            title="Content Calendar"
            description="Full calendar view of all scheduled content"
            icon="🗓️"
            accent="#f59e0b"
            onClick={openCalendar}
          />
        </div>
      </DashboardActionModal>

      {/* Publish sub-modals */}
      <DraftLibraryModal open={publishSub === 'drafts'} onClose={() => setPublishSub(null)} />
      <QualityCheckModal open={publishSub === 'quality'} onClose={() => setPublishSub(null)} />
      <TimingAdvisorModal
        open={publishSub === 'timing'}
        onClose={() => setPublishSub(null)}
        onScheduleSlot={(date, time) => {
          setTimingPrefill({ date, time });
          setPublishSub('schedule');
        }}
      />
      <ScheduleQuickModal
        open={publishSub === 'schedule'}
        onClose={() => { setPublishSub(null); setTimingPrefill(null); }}
        prefillDate={timingPrefill?.date}
        prefillTime={timingPrefill?.time}
      />
      <PublishNowModal open={publishSub === 'publish_now'} onClose={() => setPublishSub(null)} />

      <DashboardActionModal open={activeModal === 'analysis'} title="Analysis" onClose={onClose} maxWidth={640}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <DashboardToolTile
            title="Profile Analytics"
            description="Profile strength, gaps, and optimisation"
            icon="👤"
            accent="#6366f1"
            onClick={openProfileAnalytics}
          />
          <DashboardToolTile
            title="Content Analytics"
            description="Post performance and engagement trends"
            icon="📊"
            accent="#8b5cf6"
            onClick={openContentAnalytics}
          />
          <DashboardToolTile
            title="SEO Analytics"
            description="See how your LinkedIn content ranks in search"
            icon="🔎"
            accent="#0ea5e9"
            onClick={openSeoAnalytics}
          />
        </div>
      </DashboardActionModal>
    </>
  );
};

export function isWorkflowModalId(cardId: DashboardWorkflowCardId): cardId is WorkflowModalId {
  return cardId === 'plan' || cardId === 'create' || cardId === 'publish' || cardId === 'analysis';
}
