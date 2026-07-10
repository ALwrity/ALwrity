import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardActionModal } from './DashboardActionModal';
import { DashboardToolTile } from './DashboardToolTile';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import DataSourceSelector from '../Brainstorm/DataSourceSelector';
import { usePlatformPersonaContext } from '../../../shared/PersonaContext/PlatformPersonaProvider';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
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

type PlanSub = 'weekly_plan' | null;
type AnalysisSub = 'snapshot' | 'brand_score' | 'viral' | 'trends' | null;
type EngagementSub = 'booster' | 'comment' | 'opportunities' | 'pulse' | 'network' | null;
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

  const [brainstormSeed, setBrainstormSeed] = useState('');
  const [usePersona, setUsePersona] = useState(false);
  const [includeTrending, setIncludeTrending] = useState(false);
  const [remarketContent, setRemarketContent] = useState(false);

  const { corePersona } = usePlatformPersonaContext();
  const { connected } = useLinkedInSocialConnection();

  // Listen for external remarket event to pre-toggle the remarket option
  useEffect(() => {
    const onOpenBrainstormRemarket = () => {
      setRemarketContent(true);
    };
    window.addEventListener('linkedinwriter:openBrainstormRemarket', onOpenBrainstormRemarket);
    return () => {
      window.removeEventListener('linkedinwriter:openBrainstormRemarket', onOpenBrainstormRemarket);
    };
  }, []);

  const runBrainstorm = () => {
    const finalSeed = (brainstormSeed || '').trim();
    const hasOptions = usePersona || includeTrending || remarketContent;
    if (!finalSeed && !hasOptions) return;
    window.dispatchEvent(new CustomEvent('linkedinwriter:runBrainstormIdeas', {
      detail: {
        seed: finalSeed || '',
        options: { usePersona, includeTrending, remarketContent },
        forceRefresh: false,
      },
    }));
    onClose();
  };

  // ── shared dispatchers ─────────────────────────────────────────────────────
  const dispatch = (evt: string, detail?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent(evt, detail ? { detail } : undefined));
  };

  const openWatchdog        = () => { onClose(); dispatch('linkedinwriter:openWatchdog'); };
  const openTopicIdeas      = () => { onClose(); dispatch('linkedinwriter:getTopicIdeas'); };
  const openQuickCreate     = (type: string) => { onClose(); dispatch('linkedinwriter:openQuickCreate', { type }); };
  const openCalendar        = () => { onClose(); navigate('/content-planning', { state: { activeTab: 1 } }); };
  const openProfileAnalytics = () => { onClose(); dispatch('linkedinwriter:openOptimiseProfile'); };
  const openContentAnalytics = () => { onClose(); dispatch('linkedinwriter:switchTab', { tab: 'analytics' }); };
  const openSeoAnalytics    = () => { onClose(); navigate('/seo-dashboard'); };
  const openGrowthEngine    = () => { onClose(); dispatch('linkedinwriter:switchTab', { tab: 'growth' }); };

  return (
    <>
      {/* ── Plan ── */}
      <DashboardActionModal open={activeModal === 'plan'} title="Plan" onClose={onClose} maxWidth={600}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Brainstorm Card */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            {/* Card header — LinkedIn blue */}
            <div style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 7,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                🧠
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, letterSpacing: '-0.01em' }}>Brainstorm</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>Generate ideas from persona, trending topics & past content</div>
              </div>
            </div>
            {/* Card body */}
            <div style={{ padding: '12px 14px 14px' }}>
              <textarea
                value={brainstormSeed}
                onChange={(e) => setBrainstormSeed(e.target.value)}
                placeholder={corePersona?.core_belief ? `Ex: "${corePersona.core_belief}" for SMB founders` : 'Optional: theme, problem, or audience'}
                rows={2}
                style={{
                  width: '100%', border: '1px solid #d1d5db', borderRadius: 8,
                  outline: 'none', fontSize: 13, resize: 'vertical',
                  background: '#fff', padding: '8px 10px', lineHeight: 1.5, color: '#111827',
                  transition: 'border-color 0.12s, box-shadow 0.12s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0a66c2'; e.target.style.boxShadow = '0 0 0 2px rgba(10,102,194,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <DataSourceSelector
                  options={{ usePersona, includeTrending, remarketContent }}
                  onChange={(upd) => {
                    if (upd.usePersona !== undefined) setUsePersona(upd.usePersona);
                    if (upd.includeTrending !== undefined) setIncludeTrending(upd.includeTrending);
                    if (upd.remarketContent !== undefined) setRemarketContent(upd.remarketContent);
                  }}
                  connected={connected}
                />
                <button
                  onClick={runBrainstorm}
                  disabled={!(brainstormSeed || '').trim() && !usePersona && !includeTrending && !remarketContent}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 7,
                    border: 'none',
                    background: (brainstormSeed || '').trim() || usePersona || includeTrending || remarketContent
                      ? 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)'
                      : '#e5e7eb',
                    color: (brainstormSeed || '').trim() || usePersona || includeTrending || remarketContent ? '#fff' : '#9ca3af',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: (brainstormSeed || '').trim() || usePersona || includeTrending || remarketContent ? 'pointer' : 'not-allowed',
                    transition: 'opacity 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!((brainstormSeed || '').trim() || usePersona || includeTrending || remarketContent)) return;
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  Generate Ideas
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 10px' }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Other Tools</span>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>

          {/* Watchdog Card */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
              onClick={openWatchdog}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{
                width: 30, height: 30,
                borderRadius: 7,
                background: 'rgba(14,165,233,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                🔍
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#1f2937', fontSize: 14 }}>Watchdog</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Industry trends, news monitoring & growth insights</div>
              </div>
              <span style={{ color: '#0ea5e9', fontSize: 16, fontWeight: 600 }}>→</span>
            </div>
          </div>

          {/* Weekly Plan Card */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            marginTop: 10,
          }}>
            <div style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
              onClick={() => { onClose(); setPlanSub('weekly_plan'); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{
                width: 30, height: 30,
                borderRadius: 7,
                background: 'rgba(5,150,105,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                📅
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#1f2937', fontSize: 14 }}>Weekly Plan</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Mon–Fri AI content plan with Create Now + Schedule CTAs</div>
              </div>
              <span style={{ color: '#059669', fontSize: 16, fontWeight: 600 }}>→</span>
            </div>
          </div>

          {/* Content Calendar Card (WIP) */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#f9fafb',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            marginTop: 10,
            opacity: 0.6,
          }}>
            <div style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'default',
            }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 7,
                background: 'rgba(156,163,175,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                🗓️
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#9ca3af', fontSize: 14 }}>
                  Content Calendar <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', background: '#e5e7eb', padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>WIP</span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Full calendar view of all scheduled content</div>
              </div>
            </div>
          </div>
        </div>
      </DashboardActionModal>

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
