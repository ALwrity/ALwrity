import React from 'react';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import {
  ContentOpportunity,
  KeywordGap,
  QuickWin,
  PageOpportunity,
  AIRecommendations,
  AIRecommendation,
  BrainstormSummary,
} from '../../api/gscBrainstorm';

interface GSCBrainstormModalProps {
  open: boolean;
  onClose: () => void;
  contentOpportunities: ContentOpportunity[];
  keywordGaps: KeywordGap[];
  quickWins: QuickWin[];
  pageOpportunities: PageOpportunity[];
  aiRecommendations: AIRecommendations | null;
  summary: BrainstormSummary | null;
  error: string | null;
  isBrainstorming: boolean;
  progressMessage?: string;
  onSelectSuggestion: (keyword: string) => void;
  initialKeywords: string;
  onReRun: (keywords: string) => void;
}

const tabLabels = [
  'Quick Wins',
  'Opportunities',
  'Keyword Gaps',
  'Pages',
  'AI Recommendations',
] as const;
type TabKey = typeof tabLabels[number];

export const GSCBrainstormModal: React.FC<GSCBrainstormModalProps> = ({
  open,
  onClose,
  contentOpportunities,
  keywordGaps,
  quickWins,
  pageOpportunities,
  aiRecommendations,
  summary,
  error,
  isBrainstorming,
  progressMessage,
  onSelectSuggestion,
  initialKeywords,
  onReRun,
}) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('Quick Wins');
  const [topicInput, setTopicInput] = React.useState(initialKeywords);

  React.useEffect(() => setTopicInput(initialKeywords), [initialKeywords]);

  const brainstormStageDefs = [
    { id: 'fetching', label: 'Fetching', icon: '📡' },
    { id: 'analyzing', label: 'Analyzing', icon: '🔍' },
    { id: 'generating', label: 'Generating', icon: '🤖' },
    { id: 'compiling', label: 'Compiling', icon: '⚡' },
  ];

  const brainstormStageKeywords = [
    { id: 'fetching', keywords: ['fetch', 'gsc', 'search console' ] },
    { id: 'analyzing', keywords: ['analyz', 'keyword', 'opportunit', 'scan' ] },
    { id: 'generating', keywords: ['generat', 'topic', 'suggest', 'craft' ] },
    { id: 'compiling', keywords: ['compil', 'finaliz', 'packag' ] },
  ];

  const brainstormStages = React.useMemo(() => {
    let currentIdx = -1;
    if (progressMessage) {
      const msg = progressMessage.toLowerCase();
      for (let i = 0; i < brainstormStageKeywords.length; i++) {
        if (brainstormStageKeywords[i].keywords.some(kw => msg.includes(kw))) {
          currentIdx = i;
          break;
        }
      }
    }
    return brainstormStageDefs.map((stage, i) => {
      let state: 'upcoming' | 'active' | 'done' = 'upcoming';
      if (currentIdx === -1) {
        state = i === 0 ? 'active' : 'upcoming';
      } else if (i < currentIdx) {
        state = 'done';
      } else if (i === currentIdx) {
        state = 'active';
      } else {
        state = 'upcoming';
      }
      return { ...stage, state };
    });
  }, [progressMessage]);

  const brainstormProgressPct = React.useMemo(() => {
    const doneCount = brainstormStages.filter(s => s.state === 'done').length;
    const activeCount = brainstormStages.filter(s => s.state === 'active').length;
    if (doneCount === 0 && activeCount === 0) return 0;
    return Math.round(((doneCount + activeCount * 0.5) / brainstormStageDefs.length) * 100);
  }, [brainstormStages]);

  const brainstormStageStyle: Record<string, { bg: string; border: string; color: string }> = {
    upcoming: { bg: '#f1f5f9', border: '#e2e8f0', color: '#94a3b8' },
    active: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
    done: { bg: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
  };

  if (!open) return null;

  const hasData =
    contentOpportunities.length > 0 ||
    keywordGaps.length > 0 ||
    quickWins.length > 0 ||
    pageOpportunities.length > 0 ||
    aiRecommendations !== null;

  const getTabCount = (tab: TabKey): number => {
    switch (tab) {
      case 'Quick Wins': return quickWins.length;
      case 'Opportunities': return contentOpportunities.length;
      case 'Keyword Gaps': return keywordGaps.length;
      case 'Pages': return pageOpportunities.length;
      case 'AI Recommendations':
        return aiRecommendations
          ? (aiRecommendations.immediate_opportunities?.length ?? 0) +
            (aiRecommendations.content_strategy?.length ?? 0) +
            (aiRecommendations.long_term_strategy?.length ?? 0)
          : 0;
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes brainPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.15); }
          50% { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
        }
        @keyframes brainSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          width: '90vw',
          height: '90vh',
          maxWidth: '1400px',
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          padding: '10px 24px', borderBottom: '1px solid #e8e8e8', flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.01em' }}>
            Brainstorm Topics
          </h3>
          <input
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            disabled={isBrainstorming}
            placeholder="Enter topic keywords..."
            style={{
              flex: '0 1 auto', width: '35%', minWidth: '160px', padding: '6px 10px',
              border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', color: '#333',
              backgroundColor: isBrainstorming ? '#f5f5f5' : '#fff',
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              const trimmed = topicInput.trim();
              if (trimmed && trimmed.split(/\s+/).length >= 3 && !isBrainstorming) {
                onReRun(trimmed);
              }
            }}
            disabled={isBrainstorming || topicInput.trim().split(/\s+/).length < 3}
            title={
              topicInput.trim().split(/\s+/).length < 3
                ? 'Enter at least 3 words'
                : 'Re-run brainstorm with these keywords (bypasses cache)'
            }
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '8px',
              backgroundColor: isBrainstorming ? '#ccc' : '#1976d2',
              color: '#fff', fontSize: '12px', fontWeight: 600,
              cursor: isBrainstorming || topicInput.trim().split(/\s+/).length < 3 ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', transition: 'background-color 0.15s', flexShrink: 0,
            }}
          >{isBrainstorming ? 'Running...' : 'Re-Run'}</button>
          {summary?.site_url && (
            <span style={{
              fontSize: '11px', fontWeight: 500, color: '#1565c0', backgroundColor: '#e3f2fd',
              padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}>
              <span style={{ fontSize: '10px' }}>🌐</span>
              {summary.site_url.replace(/^https?:\/\//, '').slice(0, 25)}
            </span>
          )}
          {summary?.date_range?.start && (
            <span style={{
              fontSize: '11px', fontWeight: 500, color: '#6a1b9a', backgroundColor: '#f3e5f5',
              padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}>
              <span style={{ fontSize: '10px' }}>📅</span>
              Last 30 days
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
              color: '#999', padding: '2px 8px', borderRadius: '4px',
              transition: 'background-color 0.15s', lineHeight: 1, flexShrink: 0, marginLeft: 'auto',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Close"
          >✕</button>
        </div>

        {/* Loading with compact stage progress */}
        {isBrainstorming && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px', gap: '20px',
          }}>
            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 480 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{ width: `${brainstormProgressPct}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #3b82f6, #2563eb)', transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.65rem', color: '#64748b' }}>
                {brainstormStages.filter(s => s.state === 'done').length}/{brainstormStageDefs.length}
              </span>
            </div>

            {/* Stage chips */}
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 480 }}>
              {brainstormStages.map(stage => {
                const ss = brainstormStageStyle[stage.state];
                return (
                  <div key={stage.id} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, backgroundColor: ss.bg, border: `1px solid ${ss.border}`, textAlign: 'center', animation: stage.state === 'active' ? 'brainPulse 2s ease-in-out infinite' : undefined, transition: 'all 0.3s ease' }}>
                    <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 2 }}>
                      {stage.state === 'active' ? (
                        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'brainSpin 0.8s linear infinite' }} />
                      ) : stage.icon}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.6rem', color: ss.color, lineHeight: 1.2 }}>
                      {stage.state === 'active' ? 'Working…' : stage.state === 'done' ? 'Done' : stage.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', maxWidth: '520px' }}>
              {progressMessage ? (
                <p style={{
                  margin: 0, fontSize: '15px', color: '#333',
                  fontWeight: 500, lineHeight: 1.5,
                }}>
                  {progressMessage}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '15px', color: '#666', lineHeight: 1.5 }}>
                  Analyzing your GSC data and generating topic suggestions...
                </p>
              )}
              <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#999' }}>
                This usually takes 5-15 seconds
              </p>
            </div>
            <div style={{
              backgroundColor: '#f8fbff', borderRadius: '10px',
              padding: '16px 20px', maxWidth: '480px', width: '100%',
              border: '1px solid #e0ecf7',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#1565c0' }}>
                What's happening behind the scenes:
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: 1.5 }}>
                We fetch your real Google Search Console data, scan for high-ROI keywords,
                find pages that need optimization, and ask our AI to craft topic suggestions
                tailored to your site's analytics.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isBrainstorming && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '48px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.6 }}>⚠</div>
            <p style={{ color: '#d32f2f', margin: '0 0 8px', fontWeight: 500, fontSize: '15px' }}>{error}</p>
            <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>Make sure your Google Search Console is connected and has data for the last 30 days.</p>
          </div>
        )}

        {/* No data */}
        {!isBrainstorming && !error && !hasData && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '48px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>🔍</div>
            <p style={{ color: '#888', margin: 0 }}>No brainstorming data available. Try different keywords or check your GSC connection.</p>
          </div>
        )}

        {/* Results with sidebar */}
        {!isBrainstorming && !error && hasData && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left sidebar — summary metrics */}
            {summary && summary.total_keywords_analyzed > 0 && (
              <SummarySidebar summary={summary} />
            )}

            {/* Right panel — tabs + content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Gradient tabs */}
              <div style={{
                display: 'flex', gap: '6px', padding: '10px 16px 8px',
                backgroundColor: '#f5f7fa', borderBottom: '1px solid #e0e0e0',
                flexShrink: 0, flexWrap: 'wrap',
              }}>
                {tabLabels.map((tab) => {
                  const count = getTabCount(tab);
                  const isActive = activeTab === tab;
                  const tabGradients: Record<string, string> = {
                    'Quick Wins': 'linear-gradient(135deg, #43a047, #66bb6a)',
                    'Opportunities': 'linear-gradient(135deg, #ef6c00, #ffa726)',
                    'Keyword Gaps': 'linear-gradient(135deg, #1565c0, #42a5f5)',
                    'Pages': 'linear-gradient(135deg, #c62828, #ef5350)',
                    'AI Recommendations': 'linear-gradient(135deg, #6a1b9a, #ab47bc)',
                  };
                  const tabInfo: Record<string, string> = {
                    'Quick Wins': 'Keywords already on page 1 (positions 4-10). Small optimizations can push them to top 3.',
                    'Opportunities': 'Content needing improvement — high impressions with low CTR, or page 2 rankings needing a boost.',
                    'Keyword Gaps': 'Keywords ranking 4-20 with untapped traffic potential if improved to top 3.',
                    'Pages': 'Individual pages with high impressions but low click-through rates needing meta improvements.',
                    'AI Recommendations': 'AI-generated blog post suggestions based on all analysis data.',
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      title={tabInfo[tab]}
                      style={{
                        padding: '8px 18px', border: 'none', borderRadius: '20px',
                        background: isActive ? tabGradients[tab] : '#e8eaed',
                        color: isActive ? '#fff' : '#555',
                        fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap',
                        transition: 'all 0.2s', boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#d0d4da';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#e8eaed';
                        }
                      }}
                    >
                      {tab}
                      {count > 0 && (
                        <span style={{
                          backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
                          color: isActive ? '#fff' : '#666',
                          borderRadius: '10px', padding: '1px 8px',
                          fontSize: '11px', fontWeight: 600, lineHeight: '18px',
                        }}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {activeTab === 'Quick Wins' && <QuickWinsTab wins={quickWins} onSelect={onSelectSuggestion} />}
                {activeTab === 'Opportunities' && <OpportunitiesTab opportunities={contentOpportunities} onSelect={onSelectSuggestion} />}
                {activeTab === 'Keyword Gaps' && <GapsTab gaps={keywordGaps} onSelect={onSelectSuggestion} />}
                {activeTab === 'Pages' && <PagesTab pages={pageOpportunities} />}
                {activeTab === 'AI Recommendations' && <AIRecommendationsTab recommendations={aiRecommendations} onSelect={onSelectSuggestion} />}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Summary Dashboard                                                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Metric tooltips                                                    */
/* ------------------------------------------------------------------ */

const METRIC_HELP: Record<string, string> = {
  Impressions: "How many times your site appeared in Google search results over the last 30 days. More impressions means more visibility — but you also want clicks.",
  Clicks: "How many times people actually clicked on your site in search results. Low clicks with high impressions means your titles or descriptions need improvement.",
  'Avg CTR': "Click-Through Rate — the percentage of people who saw your result and clicked it. Higher is better. The industry average is around 2-3%.",
  'Avg Position': "Your average ranking across all keywords. Position 1 is the top result. Positions 1-3 get most clicks; anything below page 1 (position 10+) gets very few.",
  'SEO Health': "A composite score from 0-100 based on your rankings, CTR, and keyword distribution. 70+ is good, 40-70 needs work, below 40 needs attention.",
  'Top 3': "Keywords ranking in the top 3 positions. These are your strongest pages — already visible to most searchers. Small improvements here can bring big gains.",
  '4-10': "Keywords on page 1 of Google (positions 4-10). These have good visibility but room to climb higher. Optimizing these can push you into the top 3.",
  '11-20': "Keywords on page 2 of Google. Searchers rarely go past page 1, so writing targeted content for these keywords could dramatically increase traffic.",
  '21+': "Keywords deep in search results. Low visibility, but often easier to rank for with focused content. These represent untapped traffic potential.",
  'Rank Distribution': "Shows where your keywords fall in Google's search results. A healthy profile has keywords spread across all ranges, with a focus on page 1.",
};

const HelpIcon: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '3px' }}>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '14px', height: '14px', borderRadius: '50%',
          backgroundColor: '#bbb', color: '#fff', fontSize: '10px',
          fontWeight: 700, cursor: 'help', lineHeight: '14px', userSelect: 'none',
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >?</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#333', color: '#fff', padding: '8px 12px',
          borderRadius: '8px', fontSize: '12px', lineHeight: 1.5,
          maxWidth: '280px', width: 'max-content', textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100,
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            border: '6px solid transparent', borderTopColor: '#333',
          }} />
        </div>
      )}
    </span>
  );
};

const PIE_COLORS = ['#2e7d32', '#1565c0', '#f57c00', '#999'];

const SummarySidebar: React.FC<{ summary: BrainstormSummary }> = ({ summary }) => {
  const dist = summary.keyword_distribution || { positions_1_3: 0, positions_4_10: 0, positions_11_20: 0, positions_21_plus: 0 };
  const total = dist.positions_1_3 + dist.positions_4_10 + dist.positions_11_20 + dist.positions_21_plus || 1;
  const healthColor = summary.health_score >= 70 ? '#2e7d32' : summary.health_score >= 40 ? '#f57c00' : '#d32f2f';
  const ctrColor = summary.ctr_vs_benchmark >= 0 ? '#2e7d32' : '#d32f2f';

  const pieData = [
    { name: 'Top 3', value: dist.positions_1_3, pct: Math.round(dist.positions_1_3 / total * 100) },
    { name: '4-10', value: dist.positions_4_10, pct: Math.round(dist.positions_4_10 / total * 100) },
    { name: '11-20', value: dist.positions_11_20, pct: Math.round(dist.positions_11_20 / total * 100) },
    { name: '21+', value: dist.positions_21_plus, pct: Math.round(dist.positions_21_plus / total * 100) },
  ];

  return (
    <div style={{
      width: '240px', flexShrink: 0, backgroundColor: '#f8fbff',
      borderRight: '1px solid #e0e0e0', overflow: 'auto',
      display: 'flex', flexDirection: 'column', gap: '6px',
      padding: '14px 12px',
    }}>
      {/* Sidebar header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px',
        padding: '0 2px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
          Performance
        </span>
        <HelpIcon text={METRIC_HELP['SEO Health']} />
      </div>

      {/* Metrics */}
      <div style={{
        backgroundColor: '#fff', borderRadius: '10px', padding: '10px 12px',
        border: '1px solid #e8ecf0', display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        <MetricRow label="Keywords" value={`${summary.total_keywords_analyzed}`} />
        <MetricRow label="Impressions" value={summary.total_impressions?.toLocaleString()} tooltip={METRIC_HELP.Impressions} />
        <MetricRow label="Clicks" value={summary.total_clicks?.toLocaleString()} tooltip={METRIC_HELP.Clicks} />
        <MetricRow label="CTR" value={`${summary.avg_ctr}%`} tooltip={METRIC_HELP['Avg CTR']} rightLabel={`vs 3.1% ${summary.ctr_vs_benchmark >= 0 ? '+' : ''}${summary.ctr_vs_benchmark}%`} rightColor={ctrColor} />
        <MetricRow label="Avg Pos" value={`${summary.avg_position}`} tooltip={METRIC_HELP['Avg Position']} />
        <MetricRow label="SEO Health" value={`${summary.health_score}/100`} valueColor={healthColor} tooltip={METRIC_HELP['SEO Health']} />
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '2px 0' }} />

      {/* Pie chart + legend */}
      {total > 1 && (
        <>
          <div style={{ textAlign: 'center', backgroundColor: '#fff', borderRadius: '10px', padding: '10px', border: '1px solid #e8ecf0' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              Rank Distribution
              <HelpIcon text={METRIC_HELP['Rank Distribution']} />
            </div>
            <div style={{ width: '120px', height: '120px', margin: '0 auto' }}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={2} stroke="none">
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx]} />
                    ))}
                  </Pie>
                  <ReTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ backgroundColor: '#333', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}>
                          {d.name}: {d.value} keywords ({d.pct}%)
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', marginTop: '6px' }}>
              {pieData.map((d, idx) => (
                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#555' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PIE_COLORS[idx], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{d.name}</span>
                  <strong>{d.value}</strong>
                  <span style={{ color: '#999', minWidth: '32px', textAlign: 'right' }}>{d.pct}%</span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Health insight */}
      <div style={{
        padding: '10px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
        backgroundColor: healthColor === '#2e7d32' ? '#e8f5e9' : healthColor === '#f57c00' ? '#fff3e0' : '#ffebee',
        border: `1px solid ${healthColor === '#2e7d32' ? '#c8e6c9' : healthColor === '#f57c00' ? '#ffe0b2' : '#ffcdd2'}`,
        color: healthColor, lineHeight: 1.5,
      }}>
        <span style={{ marginRight: '4px' }}>{summary.health_score >= 70 ? '✅' : summary.health_score >= 40 ? '⚠️' : '🔴'}</span>
        {summary.health_score >= 70
          ? 'Good shape! Your topic keywords are well-positioned.'
          : summary.health_score >= 40
            ? `Need work. ${dist.positions_21_plus} keywords rank outside page 1 — write targeted content.`
            : `Low visibility. ${Math.round((dist.positions_21_plus / total) * 100)}% of keywords are beyond page 2 — focus on foundational content.`}
      </div>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string; valueColor?: string; tooltip?: string; rightLabel?: string; rightColor?: string }> = ({ label, value, valueColor, tooltip, rightLabel, rightColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '11px', color: '#888', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}>
      {label}
      {tooltip && <HelpIcon text={tooltip} />}
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: valueColor || '#1a1a1a' }}>{value}</span>
      {rightLabel && <span style={{ fontSize: '10px', color: rightColor || '#999', fontWeight: 500 }}>{rightLabel}</span>}
    </span>
  </div>
);

const MetricBox: React.FC<{
  label: string; value: string; valueColor?: string;
  sublabel?: string; sublabelColor?: string; driving?: boolean; tooltip?: string;
}> = ({ label, value, valueColor, sublabel, sublabelColor, driving, tooltip }) => (
  <div style={{
    textAlign: 'center', padding: driving ? '0 14px 0 0' : 0,
    borderRight: driving ? '1px solid #e0e0e0' : 'none',
  }}>
    <div style={{ fontSize: '18px', fontWeight: 700, color: valueColor || '#1a1a1a', lineHeight: 1.2 }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {label}
      {tooltip && <HelpIcon text={tooltip} />}
    </div>
    {sublabel && <div style={{ fontSize: '10px', color: sublabelColor || '#999', fontWeight: 500 }}>{sublabel}</div>}
  </div>
);



/* ------------------------------------------------------------------ */
/*  Quick Wins Tab                                                      */
/* ------------------------------------------------------------------ */

const QuickWinsTab: React.FC<{ wins: QuickWin[]; onSelect: (kw: string) => void }> = ({ wins, onSelect }) => {
  if (wins.length === 0) {
    return <EmptyMessage message="No quick wins found. Your page-1 keywords may already be well-optimized." />;
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#555', maxWidth: '700px' }}>
        These keywords are already on page 1. A small optimization push could land them in the top 3 — the highest-ROI opportunities available.
        <HelpIcon text="'Page 1' means Google's first search results page (positions 1-10). Being on page 1 is critical — over 90% of clicks go to page 1 results. Top 3 positions get the lion's share of those clicks." />
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {wins.map((win, i) => (
          <div
            key={i}
            style={{
              padding: '16px 18px', border: '1px solid #c8e6c9', borderRadius: '10px',
              cursor: 'pointer', transition: 'all 0.15s', backgroundColor: '#f1f8e9',
              borderLeft: '4px solid #4caf50', display: 'flex', flexDirection: 'column',
            }}
            onClick={() => onSelect(win.keyword)}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcedc8'; e.currentTarget.style.borderLeftColor = '#2e7d32'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f8e9'; e.currentTarget.style.borderLeftColor = '#4caf50'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '15px', color: '#2e7d32' }}>{win.keyword}</span>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Badge label={`#${Math.round(win.position)}`} color="#1565c0" />
                <Badge label={`+${win.estimated_traffic_gain} clicks/mo`} color="#2e7d32" />
              </div>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#444', lineHeight: 1.5, flex: 1 }}>{win.reason}</p>
            <div style={{ fontSize: '12px', color: '#888' }}>
              <InlineHelp text="Times your site appeared in Google search results">{(win.impressions.toLocaleString())} impressions</InlineHelp> &middot; <InlineHelp text="Percentage of people who saw and clicked your result">{win.current_ctr}% CTR</InlineHelp>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Opportunities Tab                                                   */
/* ------------------------------------------------------------------ */

const OpportunitiesTab: React.FC<{ opportunities: ContentOpportunity[]; onSelect: (kw: string) => void }> = ({ opportunities, onSelect }) => {
  if (opportunities.length === 0) {
    return <EmptyMessage message="No content opportunities found for this period." />;
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#555', maxWidth: '700px' }}>
        Two types of opportunities detected: <strong>Content Optimization</strong> (high impressions, low CTR — fix your title/meta) and <strong>Content Enhancement</strong> (page 2 rankings — boost content to reach page 1).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {opportunities.map((opp, i) => {
          const isBlue = opp.type === 'Content Optimization';
          const bgColor = isBlue ? '#e3f2fd' : '#fff3e0';
          const borderColor = isBlue ? '#42a5f5' : '#ffa726';
          const kwColor = isBlue ? '#1565c0' : '#e65100';
          const borderLeftColor = opp.priority === 'High' ? '#d32f2f' : borderColor;
          const hoverBg = isBlue ? '#bbdefb' : '#ffe0b2';
          const hoverBorder = opp.priority === 'High' ? '#b71c1c' : (isBlue ? '#1565c0' : '#e65100');
          return (
            <div
              key={i}
              style={{
                padding: '16px 18px', border: `1px solid ${isBlue ? '#bbdefb' : '#ffe0b2'}`, borderRadius: '10px',
                cursor: 'pointer', transition: 'all 0.15s', backgroundColor: bgColor,
                borderLeft: `4px solid ${borderLeftColor}`, display: 'flex', flexDirection: 'column',
              }}
              onClick={() => onSelect(opp.keyword)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.borderLeftColor = hoverBorder; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = bgColor; e.currentTarget.style.borderLeftColor = borderLeftColor; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '15px', color: kwColor, flex: 1 }}>{opp.keyword}</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <Badge label={opp.type === 'Content Optimization' ? 'Optimize' : 'Enhance'} color={isBlue ? '#1565c0' : '#f57c00'} />
                  <Badge label={opp.priority} color={opp.priority === 'High' ? '#d32f2f' : '#666'} />
                  {opp.suggested_format && <Badge label={opp.suggested_format} color="#6a1b9a" />}
                </div>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#444', lineHeight: 1.5, flex: 1 }}>{opp.opportunity}</p>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888', flexWrap: 'wrap' }}>
                <InlineHelp text="How many times this keyword appeared in search results">{opp.impressions.toLocaleString()} impressions</InlineHelp>
                <InlineHelp text="Your average ranking for this keyword. Position 1 = top of Google.">Pos {opp.current_position}</InlineHelp>
                <InlineHelp text="Click-Through Rate — the % of viewers who clicked on your result">{opp.current_ctr}% CTR</InlineHelp>
                <span style={{ color: '#2e7d32', fontWeight: 600 }}>+{opp.estimated_traffic_gain} clicks/mo</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Keyword Gaps Tab                                                   */
/* ------------------------------------------------------------------ */

const GapsTab: React.FC<{ gaps: KeywordGap[]; onSelect: (kw: string) => void }> = ({ gaps, onSelect }) => {
  if (gaps.length === 0) {
    return <EmptyMessage message="No keyword gaps identified. Your rankings look solid for this period." />;
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#555', maxWidth: '700px' }}>
        These keywords rank between positions 4-20. Writing targeted content could push them to page 1 where CTR increases dramatically.
        <HelpIcon text="CTR (Click-Through Rate) jumps significantly on page 1 — the #1 result gets ~28% of clicks, while page 2 results get less than 1%. Moving from page 2 to page 1 can 10x your traffic." />
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {gaps.map((gap, i) => (
          <div
            key={i}
            style={{
              padding: '16px 18px', border: '1px solid #bbdefb', borderRadius: '10px',
              cursor: 'pointer', transition: 'all 0.15s', backgroundColor: '#e3f2fd',
              borderLeft: '4px solid #42a5f5', display: 'flex', flexDirection: 'column',
            }}
            onClick={() => onSelect(gap.keyword)}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#bbdefb'; e.currentTarget.style.borderLeftColor = '#1565c0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e3f2fd'; e.currentTarget.style.borderLeftColor = '#42a5f5'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '15px', color: '#1565c0', flex: 1 }}>{gap.keyword}</span>
              <Badge label={`#${gap.position.toFixed(0)}`} color="#1565c0" />
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#444', lineHeight: 1.5, flex: 1 }}>
              <InlineHelp text="Click-Through Rate — how often searchers click your result">{gap.current_ctr}% CTR</InlineHelp> &middot; {gap.clicks} clicks &middot; <span style={{ color: '#2e7d32', fontWeight: 500 }}>+{gap.estimated_traffic_if_page1} clicks/mo if page 1</span>
            </p>
            <div style={{ fontSize: '12px', color: '#888' }}>
              <InlineHelp text="The number of positions to improve to reach top 3">{gap.gap_from_page1} positions from top 3</InlineHelp>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Pages Tab                                                           */
/* ------------------------------------------------------------------ */

const PagesTab: React.FC<{ pages: PageOpportunity[] }> = ({ pages }) => {
  if (pages.length === 0) {
    return <EmptyMessage message="No page-level issues found. Your pages are performing well." />;
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#555', maxWidth: '700px' }}>
        These pages get significant impressions but low click-through rates. Improving their titles and meta descriptions can boost clicks.
        <HelpIcon text="Meta descriptions are the short preview text under your page title in search results. A compelling meta description can double your CTR. Titles should include your target keyword and a value proposition." />
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {pages.map((pg, i) => (
          <div key={i} style={{
            padding: '16px 18px', border: '1px solid #ffcdd2', borderRadius: '10px',
            borderLeft: '4px solid #ef5350', backgroundColor: '#ffebee',
            display: 'flex', flexDirection: 'column', transition: 'background-color 0.15s',
          }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffcdd2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '15px', color: '#c62828', flex: 1 }}>{pg.page_title}</span>
              <Badge label={`${pg.current_ctr}% CTR`} color={pg.current_ctr < 1 ? '#d32f2f' : '#f57c00'} />
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#444', lineHeight: 1.5, flex: 1 }}>{pg.reason}</p>
            <div style={{ fontSize: '12px', color: '#888' }}>
              <InlineHelp text="How many times this page appeared in search results">{pg.impressions.toLocaleString()} impressions</InlineHelp> &middot; {pg.clicks} clicks &middot; <InlineHelp text="Average search ranking for this page. Lower is better.">Pos {pg.current_position}</InlineHelp>
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px', wordBreak: 'break-all' }}>{pg.page}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  AI Recommendations Tab                                              */
/* ------------------------------------------------------------------ */

const AIRecommendationsTab: React.FC<{ recommendations: AIRecommendations | null; onSelect: (kw: string) => void }> = ({ recommendations, onSelect }) => {
  if (!recommendations) {
    return <EmptyMessage message="AI recommendations are not available right now. Try again in a moment." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <RecommendationSection title="Quick Wins (0-30 days)" items={recommendations.immediate_opportunities} onSelect={onSelect} color="#1565c0" />
      <RecommendationSection title="Content Strategy (1-3 months)" items={recommendations.content_strategy} onSelect={onSelect} color="#2e7d32" />
      <RecommendationSection title="Long-Term Vision (3-12 months)" items={recommendations.long_term_strategy} onSelect={onSelect} color="#6a1b9a" />
    </div>
  );
};

const RecommendationSection: React.FC<{ title: string; items: AIRecommendation[]; onSelect: (kw: string) => void; color: string }> = ({ title, items, onSelect, color }) => {
  if (!items || items.length === 0) return null;

  const lightBg = `${color}11`;

  return (
    <div>
      <h4 style={{
        margin: '0 0 12px', fontSize: '15px', color, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{
          width: '10px', height: '10px', borderRadius: '50%',
          backgroundColor: color, display: 'inline-block', flexShrink: 0,
        }} />
        {title}
        <span style={{ fontSize: '12px', color: '#999', fontWeight: 400 }}>({items.length} suggestions)</span>
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: '16px 18px', border: `1px solid ${color}44`, borderRadius: '10px',
              cursor: 'pointer', transition: 'all 0.15s', backgroundColor: lightBg,
              borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column',
            }}
            onClick={() => {
              const kw = item.keyword || item.title.split(/[:(]/)[0].replace(/^[-\s]+/, '').trim();
              if (kw && kw.length > 2) onSelect(kw);
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${color}22`; e.currentTarget.style.borderColor = color; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = lightBg; e.currentTarget.style.borderColor = `${color}44`; }}
          >
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a', marginBottom: '4px' }}>{item.title}</div>
            {item.keyword && <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
              Target: <strong style={{ color: '#555' }}>{item.keyword}</strong>
            </div>}
            {item.reason && <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, flex: 1 }}>{item.reason}</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
              {item.format && <span style={{
                fontSize: '11px', backgroundColor: '#f0f0f0',
                padding: '2px 10px', borderRadius: '4px', color: '#666',
                fontWeight: 500,
              }}>{item.format}</span>}
              {item.estimated_impact && <span style={{
                fontSize: '11px', color: '#2e7d32', fontWeight: 600,
              }}>{item.estimated_impact}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Shared                                                              */
/* ------------------------------------------------------------------ */

const InlineHelp: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        style={{ cursor: 'help', borderBottom: '1px dashed #bbb' }}
      >{children}</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#333', color: '#fff', padding: '8px 12px',
          borderRadius: '8px', fontSize: '12px', lineHeight: 1.5,
          maxWidth: '260px', width: 'max-content', textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, whiteSpace: 'normal',
        }}>
          {text}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            border: '6px solid transparent', borderTopColor: '#333',
          }} />
        </span>
      )}
    </span>
  );
};

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    fontSize: '11px', fontWeight: 600, padding: '3px 10px',
    borderRadius: '5px', color: '#fff', backgroundColor: color,
    whiteSpace: 'nowrap',
  }}>{label}</span>
);

const EmptyMessage: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ padding: '48px 0', textAlign: 'center' }}>
    <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>{message}</p>
  </div>
);

export default GSCBrainstormModal;