/**
 * Engagement Wedge — 5 AI-first feature modals (priority order)
 *
 * E5  EngagementBoosterModal      — optimize_engagement rewrite + before/after preview score
 * E2  CommentAssistantModal       — extracted to CommentAssistantInboxModal.tsx
 * E1  OpportunitiesModal          — top 3 AI engagement opportunities from growth cache
 * E3  PostPulseModal              — real Unipile post metrics with repurpose CTAs
 * E4  NetworkAdvisorModal         — network_suggestions from cache with outreach drafts
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import {
  linkedInGrowthApi,
  type EngagementOpportunityItem,
  type NetworkSuggestionItem,
  type ConsolidatedGrowthResponse,
} from '../../../../services/linkedInGrowthApi';
import { linkedInWriterApi } from '../../../../services/linkedInWriterApi';
import {
  postAnalyticsApi,
  type LinkedInPost,
} from '../../../../services/postAnalyticsApi';
import { PreviewScoreCard } from '../GrowthEngine/PreviewScoreCard';
import {
  colors,
  rowBase,
  CONFIDENCE_COLORS,
  scoreColor,
  scoreBg,
  barColor,
} from '../GrowthEngine/styles';
import { openGrowthEngineModal } from '../../utils/linkedInDashboardEvents';

export { CommentAssistantModal } from './CommentAssistantInboxModal';

// ---------------------------------------------------------------------------
// Shared helpers (mirror of AnalysisWedgeModals pattern)
// ---------------------------------------------------------------------------

const CACHE_KEY = 'alwrity_growth_engine';
const DRAFT_KEY = 'alwrity-copilot-draft-content';

interface GrowthCachePayload { data: ConsolidatedGrowthResponse; cachedAt: number; }

function readGrowthCache(): GrowthCachePayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GrowthCachePayload) : null;
  } catch { return null; }
}

function writeGrowthCache(data: ConsolidatedGrowthResponse) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() })); } catch { /* full */ }
}

function readDraft(): string {
  try { return localStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
}

function openInCreate(topic: string, keyPoints: string, type = 'post') {
  window.dispatchEvent(new CustomEvent('linkedinwriter:openQuickCreate', {
    detail: { type, topic, key_points: keyPoints },
  }));
}

function pushDraftToStudio(text: string) {
  window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: text }));
}

function formatAge(cachedAt: number): string {
  const ms = Date.now() - cachedAt;
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const RefreshBar: React.FC<{ cachedAt: number; onRefresh: () => void; loading?: boolean }> = ({ cachedAt, onRefresh, loading }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: 11, color: colors.textTertiary }}>
    <span>Last refreshed {formatAge(cachedAt)}</span>
    <button type="button" onClick={onRefresh} disabled={loading}
      style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: 5, padding: '2px 8px', fontSize: 11, color: colors.textSecondary, cursor: loading ? 'default' : 'pointer', fontWeight: 600, opacity: loading ? 0.5 : 1 }}>
      {loading ? 'Loading…' : '↻ Refresh'}
    </button>
  </div>
);

const ConnectPrompt: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ textAlign: 'center', padding: '30px 0' }}>
    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.7 }}>🔗</div>
    <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark, marginBottom: 8 }}>LinkedIn Account Required</div>
    <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, maxWidth: 340, margin: '0 auto' }}>{message}</div>
  </div>
);

const StaleDataNote: React.FC = () => (
  <div style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: 8, color: '#92400e', fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
    <span>⚠️</span>
    <span>Showing cached data. Connect your LinkedIn account for the latest insights.</span>
  </div>
);

// ── Shared UI ────────────────────────────────────────────────────────────────

const Spinner = () => (
  <>
    <style>{`@keyframes ew-spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{
      display: 'inline-block', width: 16, height: 16,
      border: '2px solid #d1d5db', borderTopColor: colors.primary,
      borderRadius: '50%', animation: 'ew-spin 0.7s linear infinite', flexShrink: 0,
    }} />
  </>
);

const ConfPill: React.FC<{ level: string }> = ({ level }) => {
  const cc = CONFIDENCE_COLORS[level as 'high' | 'medium' | 'low'] ?? CONFIDENCE_COLORS.medium;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, background: cc.bg, color: cc.text,
      padding: '1px 6px', borderRadius: 4,
    }}>
      {level}
    </span>
  );
};

const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
    {msg}
  </div>
);

const LoadingRow: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>
    <Spinner /> {message}
  </div>
);

const EmptyPrompt: React.FC<{ icon: string; title: string; desc: string; btnLabel: string; onLoad: () => void; loading?: boolean }> = ({ icon, title, desc, btnLabel, onLoad, loading }) => (
  <div style={{ textAlign: 'center', padding: '24px 0' }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>{desc}</div>
    <button
      type="button"
      disabled={loading}
      onClick={onLoad}
      style={{ padding: '10px 24px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      {loading ? <><Spinner /> Loading…</> : btnLabel}
    </button>
  </div>
);

// Shared hook to load from growth engine cache
function useGrowthCache(open: boolean) {
  const [data, setData] = useState<ConsolidatedGrowthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const c = readGrowthCache();
    setData(c ? c.data : null);
    setError('');
    setLoading(false);
  }, [open]);

  const loadAll = useCallback(async (errMsg = 'Could not load insights. Please try again.') => {
    setLoading(true); setError('');
    try {
      const result = await linkedInGrowthApi.analyzeAll();
      writeGrowthCache(result);
      setData(result);
      return result;
    } catch { setError(errMsg); return null; }
    finally { setLoading(false); }
  }, []);

  return { data, loading, error, loadAll };
}

// ─────────────────────────────────────────────────────────────────────────────
// E5 — Engagement Booster Modal
// ─────────────────────────────────────────────────────────────────────────────

interface EngagementBoosterModalProps { open: boolean; onClose: () => void; connected?: boolean; }

export const EngagementBoosterModal: React.FC<EngagementBoosterModalProps> = ({ open, onClose, connected = true }) => {
  const [original, setOriginal] = useState('');
  const [optimised, setOptimised] = useState('');
  const [step, setStep] = useState<'input' | 'optimising' | 'scoring' | 'result'>('input');
  const [error, setError] = useState('');
  const [origScore, setOrigScore] = useState<any>(null);
  const [optScore, setOptScore] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    const draft = readDraft();
    setOriginal(draft);
    setOptimised(''); setStep('input'); setError('');
    setOrigScore(null); setOptScore(null);
  }, [open]);

  const handleOptimise = async () => {
    if (!original.trim()) { setError('Please paste or write your post first.'); return; }
    setError(''); setStep('optimising');
    try {
      const res = await linkedInWriterApi.editContent({
        content: original,
        edit_type: 'optimize_engagement',
      });
      const improved = res.content ?? '';
      setOptimised(improved);
      setStep('scoring');
      // Score both versions concurrently
      const [origRes, optRes] = await Promise.allSettled([
        linkedInGrowthApi.getPostPreviewScore({ content: original }),
        linkedInGrowthApi.getPostPreviewScore({ content: improved }),
      ]);
      if (origRes.status === 'fulfilled') setOrigScore(origRes.value);
      if (optRes.status === 'fulfilled') setOptScore(optRes.value);
      setStep('result');
    } catch {
      setError('Optimisation failed. Please try again.');
      setStep('input');
    }
  };

  const handleAccept = () => {
    pushDraftToStudio(optimised);
    onClose();
  };

  return (
    <DashboardActionModal open={open} title="Engagement Booster" onClose={onClose} maxWidth={620} maxHeight="min(92vh, 800px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        AI rewrites your draft to maximise engagement — stronger hooks, clearer CTAs, better formatting. Shows a before/after score.
      </p>

      {step === 'input' && (
        <>
          {!connected && (
            <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, color: '#1e40af', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>ℹ️</span>
              <span>Connect LinkedIn for accurate engagement scoring on before/after versions.</span>
            </div>
          )}
          {error && <ErrorBanner msg={error} />}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMedium, marginBottom: 6 }}>
              Your Post Draft
            </div>
            <textarea
              value={original}
              onChange={e => setOriginal(e.target.value)}
              placeholder="Paste your LinkedIn post here, or open the editor first to auto-fill from your current draft…"
              style={{
                width: '100%', minHeight: 140, padding: '10px 12px', borderRadius: 8,
                border: `1.5px solid ${colors.border}`, fontSize: 13, resize: 'vertical',
                fontFamily: 'inherit', lineHeight: 1.6, color: colors.textBody, boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
              {original.length} characters
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleOptimise()}
            disabled={!original.trim()}
            style={{
              width: '100%', padding: '11px', background: colors.primary, color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: original.trim() ? 'pointer' : 'default', opacity: original.trim() ? 1 : 0.5,
            }}
          >
            ⚡ Optimise for Engagement
          </button>
        </>
      )}

      {(step === 'optimising' || step === 'scoring') && (
        <LoadingRow message={step === 'optimising' ? 'Rewriting for maximum engagement…' : 'Scoring both versions…'} />
      )}

      {step === 'result' && (
        <>
          {/* Score comparison */}
          {(origScore || optScore) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <ScoreBadge label="Original" score={origScore?.overall_score ?? null} />
              <ScoreBadge label="Optimised" score={optScore?.overall_score ?? null} highlight />
            </div>
          )}

          {/* Side-by-side diff */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <DraftPane label="Before" content={original} accent="#94a3b8" />
            <DraftPane label="After (AI)" content={optimised} accent={colors.primary} />
          </div>

          {optScore && (
            <div style={{ marginBottom: 14 }}>
              <PreviewScoreCard
                overallScore={optScore.overall_score}
                dimensions={optScore.dimensions ?? []}
                topImprovement={optScore.top_improvement ?? ''}
                dataSourceSummary={optScore.data_source_summary ?? ''}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleAccept}
              style={{ flex: 1, padding: '10px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              ✅ Use Optimised Version
            </button>
            <button
              type="button"
              onClick={() => setStep('input')}
              style={{ padding: '10px 18px', background: 'none', border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: 'pointer' }}
            >
              ↩ Edit Again
            </button>
          </div>
        </>
      )}
    </DashboardActionModal>
  );
};

const ScoreBadge: React.FC<{ label: string; score: number | null; highlight?: boolean }> = ({ label, score, highlight }) => {
  const bg = score !== null ? scoreBg(score) : '#f1f5f9';
  const fc = score !== null ? scoreColor(score) : colors.textTertiary;
  return (
    <div style={{ background: highlight ? '#eff6ff' : '#f8fafc', border: `1.5px solid ${highlight ? '#bfdbfe' : colors.border}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      {score !== null ? (
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: bg, color: fc, fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: `2px solid ${barColor(score)}44` }}>
          {score}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: colors.textTertiary }}>—</div>
      )}
    </div>
  );
};

const DraftPane: React.FC<{ label: string; content: string; accent: string }> = ({ label, content, accent }) => (
  <div style={{ borderLeft: `3px solid ${accent}`, background: colors.rowBg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 12, color: colors.textBody, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto' }}>{content}</div>
  </div>
);

function textareaStyle(minH: number): React.CSSProperties {
  return {
    width: '100%', minHeight: minH, padding: '9px 11px', borderRadius: 8,
    border: `1.5px solid ${colors.border}`, fontSize: 12, resize: 'vertical',
    fontFamily: 'inherit', lineHeight: 1.6, color: colors.textBody,
    boxSizing: 'border-box', marginBottom: 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// E1 — Engagement Opportunities Quick-View
// ─────────────────────────────────────────────────────────────────────────────

interface OpportunitiesModalProps { open: boolean; onClose: () => void; connected?: boolean; }

export const OpportunitiesModal: React.FC<OpportunitiesModalProps> = ({ open, onClose, connected = true }) => {
  const { data, loading, error, loadAll } = useGrowthCache(open);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [refineIdx, setRefineIdx] = useState<number | null>(null);

  useEffect(() => { if (open) setDismissed(new Set()); }, [open]);

  const opportunities: EngagementOpportunityItem[] = useMemo(
    () => data?.engagement_opportunities?.opportunities ?? [],
    [data]
  );
  const visible = opportunities.filter((_, i) => !dismissed.has(i)).slice(0, 3);

  const handleCopy = async (text: string, idx: number) => {
    try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <DashboardActionModal open={open} title="Engagement Opportunities" onClose={onClose} maxWidth={560} maxHeight="min(92vh, 720px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        AI-identified conversations to engage with now — copy a comment, refine it, or create a post on the topic.
      </p>

      {!connected && data && <StaleDataNote />}

      {!data && !loading && !connected && (
        <ConnectPrompt message="Connect your LinkedIn account to discover engagement opportunities tailored to your network." />
      )}

      {!data && !loading && connected && (
        <EmptyPrompt
          icon="💬"
          title="No opportunities cached"
          desc="Load AI analysis to find the top engagement opportunities in your industry."
          btnLabel="🚀 Load Opportunities"
          onLoad={() => void loadAll()}
          loading={loading}
        />
      )}
      {loading && <LoadingRow message="Finding engagement opportunities…" />}
      {error && <ErrorBanner msg={error} />}

      {data && !loading && visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: colors.textSecondary, fontSize: 13 }}>
          All opportunities dismissed. <button type="button" onClick={() => void loadAll()} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Refresh →</button>
        </div>
      )}

      {!loading && visible.map((item, displayIdx) => {
        const origIdx = opportunities.indexOf(item);
        const isCopied = copiedIdx === origIdx;
        const isRefining = refineIdx === origIdx;
        return (
          <div key={origIdx} style={{ ...rowBase, marginBottom: 10, borderLeft: `3px solid ${(CONFIDENCE_COLORS[item.confidence] ?? CONFIDENCE_COLORS.medium).bg === CONFIDENCE_COLORS.high.bg ? '#0a66c2' : '#8b5cf6'}` }}>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: colors.textDark, marginBottom: 2 }}>📢 {item.title}</div>
              <div style={{ fontSize: 11, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.author} · {item.author_context} <ConfPill level={item.confidence} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: colors.textMedium, fontStyle: 'italic', marginBottom: 8 }}>💡 {item.why_engage}</div>
            <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 7, padding: '8px 11px', fontSize: 12, color: colors.textBody, lineHeight: 1.55, marginBottom: 10 }}>
              💬 {item.suggested_comment}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void handleCopy(item.suggested_comment, origIdx)}
                style={{ padding: '5px 12px', background: isCopied ? '#dcfce7' : colors.primary, color: isCopied ? '#166534' : '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {isCopied ? '✓ Copied' : '📋 Copy Comment'}
              </button>
              <button type="button" onClick={() => setRefineIdx(isRefining ? null : origIdx)}
                style={{ padding: '5px 12px', background: isRefining ? '#eff6ff' : 'none', border: `1.5px solid ${colors.primary}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: colors.primary, cursor: 'pointer' }}>
                ✏️ Refine Reply
              </button>
              <button type="button" onClick={() => { openInCreate(item.title, item.suggested_comment); onClose(); }}
                style={{ padding: '5px 12px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: 11, color: colors.textSecondary, cursor: 'pointer' }}>
                ✍️ Create Post
              </button>
              <button type="button" onClick={() => setDismissed(prev => new Set(prev).add(origIdx))}
                style={{ padding: '5px 10px', background: 'none', border: 'none', borderRadius: 6, fontSize: 11, color: colors.textTertiary, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            {isRefining && (
              <InlineRefineForm
                comment={item.suggested_comment}
                originalPost={item.title}
                onClose={() => setRefineIdx(null)}
                onAccept={(text) => { pushDraftToStudio(text); onClose(); }}
              />
            )}
          </div>
        );
      })}

      {data && !loading && opportunities.length > 3 && (
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
          {opportunities.length - 3} more in the{' '}
          <button type="button" onClick={() => { openGrowthEngineModal(); onClose(); }}
            style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
            Growth Engine →
          </button>
        </div>
      )}
    </DashboardActionModal>
  );
};

// Small inline refine form inside opportunity card
const InlineRefineForm: React.FC<{ comment: string; originalPost: string; onClose: () => void; onAccept: (text: string) => void }> = ({ comment, originalPost, onClose, onAccept }) => {
  const [text, setText] = useState(comment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRefine = async () => {
    setLoading(true); setError('');
    try {
      const res = await linkedInWriterApi.generateCommentResponse({
        original_post: originalPost,
        comment,
        response_type: 'value_add',
      });
      if (res.response) setText(res.response);
    } catch { setError('Could not refine. Edit manually above.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ marginTop: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>Refine Reply</div>
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 6 }}>{error}</div>}
      <textarea value={text} onChange={e => setText(e.target.value)} style={{ ...textareaStyle(70), marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => void handleRefine()} disabled={loading}
          style={{ padding: '5px 12px', background: '#0a66c2', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          {loading ? <><Spinner /> Refining…</> : '✨ AI Refine'}
        </button>
        <button type="button" onClick={() => onAccept(text)}
          style={{ padding: '5px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          Use This
        </button>
        <button type="button" onClick={onClose}
          style={{ padding: '5px 10px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: 11, color: colors.textTertiary, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// E3 — Post Engagement Pulse
// ─────────────────────────────────────────────────────────────────────────────

interface PostPulseModalProps { open: boolean; onClose: () => void; connected?: boolean; }

export const PostPulseModal: React.FC<PostPulseModalProps> = ({ open, onClose, connected = true }) => {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [boosting, setBoosting] = useState<string | null>(null);
  const [boosted, setBoosted] = useState<Record<string, string>>({});
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const fetchPosts = useCallback(async (refresh = false) => {
    setLoading(true); setError('');
    try {
      const res = await postAnalyticsApi.fetchStoredAnalytics(refresh);
      const fetched = res.posts ?? [];
      setPosts(fetched);
      if (fetched.length > 0) setLoadedAt(Date.now());
    } catch {
      setError('Could not load your posts. Make sure LinkedIn is connected.');
    } finally { setLoading(false); }
  }, []);

  // On mount: reset state, auto-load from DB cache
  useEffect(() => {
    if (!open) return;
    setError(''); setBoosted({}); setPosts([]); setLoadedAt(null);
    void fetchPosts(false);
  }, [open, fetchPosts]);

  const sorted = useMemo(() =>
    [...posts].sort((a, b) => (b.engagement?.engagement_rate ?? 0) - (a.engagement?.engagement_rate ?? 0)),
    [posts]
  );
  const topPosts = sorted.slice(0, 3);
  const bottomPost = sorted[sorted.length - 1];

  const handleBoost = async (post: LinkedInPost) => {
    setBoosting(post.id);
    try {
      const res = await linkedInWriterApi.editContent({
        content: post.text,
        edit_type: 'optimize_engagement',
      });
      const improved = res.content ?? '';
      setBoosted(prev => ({ ...prev, [post.id]: improved }));
    } catch { setError('Could not boost this post. Please try again.'); }
    finally { setBoosting(null); }
  };

  return (
    <DashboardActionModal open={open} title="Post Engagement Pulse" onClose={onClose} maxWidth={580} maxHeight="min(92vh, 740px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        Real engagement metrics from your recent LinkedIn posts. Repurpose winners and boost underperformers.
      </p>

      {loading && <LoadingRow message="Loading your post metrics from LinkedIn…" />}
      {error && <ErrorBanner msg={error} />}

      {/* No cache + not connected → connect prompt */}
      {!loading && posts.length === 0 && !connected && !error && (
        <ConnectPrompt message="Connect your LinkedIn account to view engagement metrics for your published posts." />
      )}

      {/* No cache + connected → empty state with Load button */}
      {!loading && posts.length === 0 && connected && !error && (
        <EmptyPrompt
          icon="📊"
          title="No posts loaded yet"
          desc="Load your recent LinkedIn posts to see engagement metrics."
          btnLabel="🚀 Load Posts"
          onLoad={() => void fetchPosts(false)}
        />
      )}

      {/* Cached/loaded posts */}
      {!loading && topPosts.length > 0 && (
        <>
          {/* RefreshBar — triggers full sync from Unipile */}
          {loadedAt && <RefreshBar cachedAt={loadedAt} onRefresh={() => void fetchPosts(true)} loading={loading} />}

          <SectionHeader icon="🏆" label="Top Performing Posts" />
          {topPosts.map(post => (
            <PostMetricsRow
              key={post.id}
              post={post}
              boostedVersion={boosted[post.id]}
              isBoosting={boosting === post.id}
              onRepurpose={() => { openInCreate(post.title ?? 'Post', post.text.slice(0, 200)); onClose(); }}
              onWriteMore={() => { openInCreate('Write more content like this', post.text.slice(0, 200)); onClose(); }}
              onBoost={() => void handleBoost(post)}
              onAcceptBoost={() => { pushDraftToStudio(boosted[post.id]); onClose(); }}
            />
          ))}

          {bottomPost && !topPosts.includes(bottomPost) && (
            <>
              <SectionHeader icon="⬇️" label="Needs a Boost" />
              <PostMetricsRow
                post={bottomPost}
                boostedVersion={boosted[bottomPost.id]}
                isBoosting={boosting === bottomPost.id}
                onRepurpose={() => { openInCreate(bottomPost.title ?? 'Post', bottomPost.text.slice(0, 200)); onClose(); }}
                onWriteMore={() => { openInCreate('Write more content like this', bottomPost.text.slice(0, 200)); onClose(); }}
                onBoost={() => void handleBoost(bottomPost)}
                onAcceptBoost={() => { pushDraftToStudio(boosted[bottomPost.id]); onClose(); }}
                dim
              />
            </>
          )}
        </>
      )}
    </DashboardActionModal>
  );
};

const SectionHeader: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
    <span style={{ fontSize: 14 }}>{icon}</span>{label}
  </div>
);

interface PostMetricsRowProps {
  post: LinkedInPost;
  boostedVersion?: string;
  isBoosting: boolean;
  onRepurpose: () => void;
  onWriteMore: () => void;
  onBoost: () => void;
  onAcceptBoost: () => void;
  dim?: boolean;
}

const PostMetricsRow: React.FC<PostMetricsRowProps> = ({ post, boostedVersion, isBoosting, onRepurpose, onWriteMore, onBoost, onAcceptBoost, dim }) => {
  const m = post.engagement;
  const rate = m?.engagement_rate ?? 0;
  const ratePct = (rate * 100).toFixed(1);
  const rateColor = rate >= 0.05 ? '#166534' : rate >= 0.02 ? '#854d0e' : '#991b1b';
  const rateBg = rate >= 0.05 ? '#dcfce7' : rate >= 0.02 ? '#fef9c3' : '#fee2e2';
  const snippet = post.text.slice(0, 100) + (post.text.length > 100 ? '…' : '');

  return (
    <div style={{ ...rowBase, marginBottom: 10, opacity: dim ? 0.85 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textDark, flex: 1, lineHeight: 1.4 }}>{snippet}</div>
        <span style={{ fontSize: 11, fontWeight: 800, background: rateBg, color: rateColor, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {ratePct}% eng.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <MetricChip icon="❤️" value={m?.reactions ?? 0} label="reactions" />
        <MetricChip icon="💬" value={m?.comments ?? 0} label="comments" />
        <MetricChip icon="🔁" value={m?.reposts ?? 0} label="reposts" />
        <MetricChip icon="👁️" value={m?.impressions ?? 0} label="views" />
      </div>

      {boostedVersion ? (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>⚡ Boosted Version</div>
          <div style={{ fontSize: 12, color: '#1e3a5f', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{boostedVersion.slice(0, 200)}{boostedVersion.length > 200 ? '…' : ''}</div>
          <button type="button" onClick={onAcceptBoost} style={{ marginTop: 8, padding: '5px 12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            ✅ Use in Studio
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onRepurpose} style={{ padding: '5px 12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            ♻️ Repurpose
          </button>
          <button type="button" onClick={onWriteMore} style={{ padding: '5px 12px', background: 'none', border: `1.5px solid ${colors.primary}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: colors.primary, cursor: 'pointer' }}>
            ✍️ Write More Like This
          </button>
          {dim && (
            <button type="button" onClick={onBoost} disabled={isBoosting}
              style={{ padding: '5px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              {isBoosting ? <><Spinner /> Boosting…</> : '⚡ Boost Engagement'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MetricChip: React.FC<{ icon: string; value: number; label: string }> = ({ icon, value, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
    <span style={{ fontSize: 12 }}>{icon}</span>
    <span style={{ fontSize: 12, fontWeight: 700, color: colors.textDark }}>{value.toLocaleString()}</span>
    <span style={{ fontSize: 10, color: colors.textTertiary }}>{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// E4 — Network Growth Advisor
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkAdvisorModalProps { open: boolean; onClose: () => void; connected?: boolean; }

export const NetworkAdvisorModal: React.FC<NetworkAdvisorModalProps> = ({ open, onClose, connected = true }) => {
  const { data, loading, error, loadAll } = useGrowthCache(open);
  const [drafting, setDrafting] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [draftError, setDraftError] = useState('');

  useEffect(() => { if (open) setDrafts({}); }, [open]);

  const suggestions: NetworkSuggestionItem[] = useMemo(
    () => data?.network_suggestions?.suggestions ?? [],
    [data]
  );

  const handleDraftOutreach = async (item: NetworkSuggestionItem, idx: number) => {
    setDrafting(idx); setDraftError('');
    try {
      const res = await linkedInWriterApi.generateCommentResponse({
        original_post: `I want to connect with ${item.name}, ${item.title} at ${item.company}.`,
        comment: `Context: ${item.why_connect}. Their suggested note: "${item.suggested_note}"`,
        response_type: 'professional',
      });
      setDrafts(prev => ({ ...prev, [idx]: res.response ?? item.suggested_note }));
    } catch {
      setDrafts(prev => ({ ...prev, [idx]: item.suggested_note }));
      setDraftError('AI refinement failed, using suggested note.');
    } finally { setDrafting(null); }
  };

  return (
    <DashboardActionModal open={open} title="Network Growth Advisor" onClose={onClose} maxWidth={560} maxHeight="min(92vh, 740px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        AI-suggested connections to grow your network this week — with personalised outreach messages.
      </p>

      {!connected && data && <StaleDataNote />}

      {!data && !loading && !connected && (
        <ConnectPrompt message="Connect your LinkedIn account to get personalised network suggestions based on your profile and activity." />
      )}

      {!data && !loading && connected && (
        <EmptyPrompt
          icon="🤝"
          title="No network suggestions cached"
          desc="Load an AI analysis to discover the right people to connect with."
          btnLabel="🚀 Load Suggestions"
          onLoad={() => void loadAll()}
          loading={loading}
        />
      )}
      {loading && <LoadingRow message="Analysing your network growth opportunities…" />}
      {error && <ErrorBanner msg={error} />}
      {draftError && <ErrorBanner msg={draftError} />}

      {!loading && suggestions.slice(0, 3).map((item, idx) => {
        const hasDraft = !!drafts[idx];
        const isDrafting = drafting === idx;
        return (
          <div key={idx} style={{ ...rowBase, marginBottom: 10, borderLeft: `3px solid ${idx === 0 ? colors.primary : colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: colors.textDark }}>🤝 {item.name}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary }}>{item.title} · {item.company}</div>
              </div>
              <ConfPill level={item.confidence} />
            </div>
            <div style={{ fontSize: 12, color: colors.textMedium, fontStyle: 'italic', marginBottom: 8 }}>💡 {item.why_connect}</div>

            {hasDraft ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, padding: '8px 11px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Personalised Outreach Note</div>
                <div style={{ fontSize: 12, color: '#14532d', lineHeight: 1.55 }}>{drafts[idx]}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => { void navigator.clipboard.writeText(drafts[idx]); }}
                    style={{ padding: '4px 10px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    📋 Copy Note
                  </button>
                  <button type="button" onClick={() => { pushDraftToStudio(drafts[idx]); onClose(); }}
                    style={{ padding: '4px 10px', background: 'none', border: `1px solid ${colors.primary}`, borderRadius: 5, fontSize: 11, color: colors.primary, cursor: 'pointer', fontWeight: 600 }}>
                    Edit in Studio
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: colors.textSecondary, background: colors.badgeBg, padding: '6px 10px', borderRadius: 6, marginBottom: 8, fontStyle: 'italic' }}>
                "{item.suggested_note}"
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!hasDraft && (
                <button type="button" onClick={() => void handleDraftOutreach(item, idx)} disabled={isDrafting}
                  style={{ padding: '5px 12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isDrafting ? <><Spinner /> Drafting…</> : '✉️ Draft Outreach Note'}
                </button>
              )}
              <button type="button" onClick={() => { openInCreate(item.name + "'s focus area", item.why_connect + '\n' + item.suggested_note); onClose(); }}
                style={{ padding: '5px 12px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: 11, color: colors.textSecondary, cursor: 'pointer' }}>
                ✍️ Post on Their Topic
              </button>
            </div>
          </div>
        );
      })}

      {!loading && suggestions.length > 3 && (
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
          + {suggestions.length - 3} more in the{' '}
          <button type="button" onClick={() => { openGrowthEngineModal(); onClose(); }}
            style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
            Growth Engine →
          </button>
        </div>
      )}
    </DashboardActionModal>
  );
};
