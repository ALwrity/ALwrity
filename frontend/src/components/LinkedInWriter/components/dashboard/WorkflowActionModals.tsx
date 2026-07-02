import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardActionModal } from './DashboardActionModal';
import { DashboardToolTile } from './DashboardToolTile';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';

export type WorkflowModalId = 'plan' | 'create' | 'publish' | 'analysis';

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
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
          />
        </div>
      </DashboardActionModal>

      <DashboardActionModal open={activeModal === 'analysis'} title="Analysis" onClose={onClose} maxWidth={640}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
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
            description="Post performance and engagement trends"
            icon="📊"
            accent="#8b5cf6"
            onClick={openContentAnalytics}
            disabled={!connected}
            disabledReason={CONNECT_REQUIRED_REASON}
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
