import React, { useState, useEffect } from 'react';
import { BlogWorkflowHeroSection } from './dashboard/BlogWorkflowHeroSection';
import { GSCBrainstormModal } from './GSCBrainstormModal';
import { useGSCBrainstorm } from '../../hooks/useGSCBrainstorm';

interface BlogWriterLandingProps {
  onStartWriting: () => void;
  navigateToPhase?: (phase: string) => void;
  hasResearch?: boolean;
  onRestoreAsset?: (assetId: number) => void;
  currentPhase?: string;
}

const BlogWriterLanding: React.FC<BlogWriterLandingProps> = ({
  onStartWriting,
  navigateToPhase,
  hasResearch,
  onRestoreAsset,
  currentPhase,
}) => {
  const [showBrainstorm, setShowBrainstorm] = useState(false);

  const {
    gscConnected,
    isConnecting,
    connectError,
    isBrainstorming,
    brainstormError,
    brainstormResult,
    contentOpportunities,
    keywordGaps,
    quickWins,
    pageOpportunities,
    aiRecommendations,
    summary,
    connectGSC,
    brainstorm,
    reset,
    progressMessage,
    lastKeywords,
  } = useGSCBrainstorm();

  const handleReRun = (keywords: string, forceRefresh?: boolean) => {
    if (keywords.trim() && !isBrainstorming) {
      brainstorm(keywords.trim(), undefined, forceRefresh);
    }
  };

  // Auto-fill input with last keywords on mount
  useEffect(() => {
    if (lastKeywords) {
      const input = document.getElementById('gsc-sidebar-input') as HTMLInputElement;
      if (input) input.value = lastKeywords;
    }
  }, [lastKeywords]);

  const handleSelectSuggestion = (keyword: string) => {
    if (navigateToPhase) {
      navigateToPhase('research');
    }
    onStartWriting();
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, #f8f9ff 0%, #eef2ff 40%, #faf5ff 100%)',
      overflow: 'hidden',
    }}>
      {/* Main area — wheel fills all available space */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        minWidth: 0,
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(120,119,198,0.12) 0%, rgba(25,118,210,0.06) 35%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          width: '100%',
          maxWidth: 'min(88vw, 780px)',
          maxHeight: 'min(82vh, 780px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <BlogWorkflowHeroSection
            inline
            onStartWriting={onStartWriting}
            navigateToPhase={navigateToPhase}
            hasResearch={hasResearch}
            onRestoreAsset={onRestoreAsset}
            currentPhase={currentPhase}
          />
        </div>
      </div>

      {/* Right sidebar area — GSC brainstorm trigger */}
      <div style={{
        width: 360,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #e8ecf1',
        background: '#fff',
        boxShadow: '-2px 0 16px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '16px 18px 12px',
          borderBottom: '1px solid #e8ecf1',
        }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
            Brainstorm Topics
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
            Discover content ideas from your Google Search Console data
          </p>
        </div>

        {/* Keyword input + brainstorm trigger */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0' }}>
          <input
            type="text"
            placeholder="Enter topic keywords..."
            disabled={isBrainstorming || !gscConnected}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
              outline: 'none',
              background: '#f8fafc',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#1976d2')}
            onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                handleReRun(e.currentTarget.value);
              }
            }}
            id="gsc-sidebar-input"
          />
          <button
            onClick={() => {
              const input = document.getElementById('gsc-sidebar-input') as HTMLInputElement;
              if (input?.value.trim()) handleReRun(input.value);
            }}
            disabled={isBrainstorming || !gscConnected}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: gscConnected && !isBrainstorming
                ? 'linear-gradient(135deg, #1976d2 0%, #7c3aed 100%)'
                : '#e2e8f0',
              color: gscConnected && !isBrainstorming ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: gscConnected && !isBrainstorming ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            {isBrainstorming ? progressMessage || 'Analyzing...' : 'Brainstorm Topics'}
          </button>
        </div>

        {/* Not connected state */}
        {!gscConnected && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.4 }}>🔗</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Connect Google Search Console
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 16, lineHeight: 1.5 }}>
              Unlock real search data to discover what your audience is searching for
            </div>
            <button
              onClick={connectGSC}
              disabled={isConnecting}
              style={{
                padding: '9px 24px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect GSC'}
            </button>
            {connectError && (
              <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 12 }}>
                {connectError}
              </div>
            )}
          </div>
        )}

        {/* Quick hint — connected but no brainstorm yet */}
        {gscConnected && !brainstormResult && !isBrainstorming && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.4 }}>💡</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Enter a topic above
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Type keywords related to your blog niche and click Brainstorm to analyze GSC data for content ideas
            </div>
          </div>
        )}

        {/* Brainstorm error */}
        {brainstormError && !isBrainstorming && (
          <div style={{ padding: '12px 18px' }}>
            <div style={{
              padding: '12px', borderRadius: 10,
              background: '#fef2f2', color: '#dc2626',
              fontSize: '0.8rem', lineHeight: 1.4,
            }}>
              {brainstormError}
            </div>
          </div>
        )}

        {/* Summary + Quick wins preview — scrollable */}
        {brainstormResult && !isBrainstorming && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
            {/* Summary mini cards */}
            {summary && (
              <div style={{
                marginBottom: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)',
                border: '1px solid #e8ecf1',
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '6px 12px',
                }}>
                  {[
                    { label: 'Keywords', value: summary.total_keywords_analyzed?.toLocaleString() },
                    { label: 'Impressions', value: summary.total_impressions?.toLocaleString() },
                    { label: 'Clicks', value: summary.total_clicks?.toLocaleString() },
                    { label: 'CTR', value: `${summary.avg_ctr}%` },
                    { label: 'Avg Position', value: `${summary.avg_position}` },
                    { label: 'SEO Health', value: `${summary.health_score}/100` },
                  ].map((m) => (
                    <div key={m.label}>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{m.label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick wins preview */}
            {quickWins.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700, color: '#059669',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                }}>
                  Quick Wins ({quickWins.length})
                </div>
                {quickWins.slice(0, 5).map((qw, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px', borderRadius: 10, border: '1px solid #e8ecf1',
                      background: '#fafbfc', marginBottom: 6, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f4ff';
                      e.currentTarget.style.borderColor = '#c7d2fe';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fafbfc';
                      e.currentTarget.style.borderColor = '#e8ecf1';
                    }}
                    onClick={() => handleSelectSuggestion(qw.keyword)}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                      {qw.keyword}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                      Pos {qw.position} · {qw.impressions?.toLocaleString()} imp
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View full results + Refresh */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowBrainstorm(true)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #c7d2fe',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
              >
                View Full Results →
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('gsc-sidebar-input') as HTMLInputElement;
                  const kw = input?.value.trim() || lastKeywords;
                  if (kw) handleReRun(kw, true);
                }}
                disabled={isBrainstorming}
                title="Fetch fresh GSC data (bypasses cache)"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: isBrainstorming ? '#f1f5f9' : '#fff',
                  color: isBrainstorming ? '#94a3b8' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: isBrainstorming ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isBrainstorming) { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }
                }}
                onMouseLeave={(e) => {
                  if (!isBrainstorming) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full GSC Brainstorm Modal — same as what appears when clicking Brainstorm Topics in research phase */}
      <GSCBrainstormModal
        open={showBrainstorm}
        onClose={() => setShowBrainstorm(false)}
        contentOpportunities={contentOpportunities}
        keywordGaps={keywordGaps}
        quickWins={quickWins}
        pageOpportunities={pageOpportunities}
        aiRecommendations={aiRecommendations}
        summary={summary}
        error={brainstormError}
        isBrainstorming={isBrainstorming}
        progressMessage={progressMessage}
        onSelectSuggestion={handleSelectSuggestion}
        initialKeywords=""
        onReRun={handleReRun}
      />
    </div>
  );
};

export default BlogWriterLanding;
