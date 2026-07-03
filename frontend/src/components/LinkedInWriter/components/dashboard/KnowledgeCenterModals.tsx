/**
 * Knowledge Center — 5 AI-first feature modals
 *
 * F1  ContentCoachModal      — real-time AI coaching on the current draft
 * F2  QuickStartWizardModal  — 3-step goal → format → topic wizard, launches QuickCreate
 * F3  BestPracticesModal     — format-specific LinkedIn cheat sheets + viral patterns
 * F4  FeatureMapModal        — interactive guide to all wedges and AI capabilities
 * F5  AskAlwrityModal        — curated FAQ accordion + free-text LinkedIn Q&A
 */
import React, { useEffect, useState, useCallback } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import { DASHBOARD_WORKFLOW_CARDS } from './dashboardWorkflowConfig';
import { linkedInGrowthApi, type PostPreviewDimension } from '../../../../services/linkedInGrowthApi';
import { linkedInWriterApi } from '../../../../services/linkedInWriterApi';
import type { ConsolidatedGrowthResponse } from '../../../../services/linkedInGrowthApi';

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'alwrity-copilot-draft-content';
const GROWTH_CACHE_KEY = 'alwrity_growth_engine';
const GROWTH_CACHE_TTL = 30 * 60 * 1000; // 30 min

const C = {
  primary: '#0a66c2',
  textDark: '#0f172a',
  textBody: '#334155',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  border: '#e2e8f0',
  rowBg: '#f8fafc',
  badgeBg: '#f0f4f8',
};

function readDraft(): string {
  try { return localStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
}

function readGrowthCache(): ConsolidatedGrowthResponse | null {
  try {
    const raw = sessionStorage.getItem(GROWTH_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { data: ConsolidatedGrowthResponse; cachedAt: number };
    if (Date.now() - p.cachedAt > GROWTH_CACHE_TTL) return null;
    return p.data;
  } catch { return null; }
}

function pushDraftToStudio(text: string) {
  window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: text }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

const Spinner = () => (
  <>
    <style>{`@keyframes kc-spin{to{transform:rotate(360deg)}}`}</style>
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #d1d5db', borderTopColor: C.primary, borderRadius: '50%', animation: 'kc-spin 0.7s linear infinite', flexShrink: 0 }} />
  </>
);

const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{msg}</div>
);

const Tag: React.FC<{ label: string; color?: string }> = ({ label, color = '#dbeafe' }) => (
  <span style={{ fontSize: 10, fontWeight: 700, background: color, color: C.textBody, padding: '2px 7px', borderRadius: 4 }}>{label}</span>
);

// ─────────────────────────────────────────────────────────────────────────────
// F1 — Live Content Coach
// ─────────────────────────────────────────────────────────────────────────────

const EDIT_TYPE_FOR_DIMENSION: Record<string, 'optimize_engagement' | 'add_cta' | 'condense' | 'expand' | 'professionalize' | 'add_hashtags' | 'adjust_tone'> = {
  engagement: 'optimize_engagement',
  hook: 'optimize_engagement',
  cta: 'add_cta',
  length: 'condense',
  readability: 'professionalize',
  hashtags: 'add_hashtags',
  tone: 'adjust_tone',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#166534';
  if (score >= 60) return '#854d0e';
  return '#dc2626';
}

function scoreBg(score: number): string {
  if (score >= 80) return '#dcfce7';
  if (score >= 60) return '#fef9c3';
  return '#fef2f2';
}

function guessEditType(dim: PostPreviewDimension): 'optimize_engagement' | 'add_cta' | 'condense' | 'expand' | 'professionalize' | 'add_hashtags' | 'adjust_tone' {
  const name = dim.dimension.toLowerCase();
  for (const [key, val] of Object.entries(EDIT_TYPE_FOR_DIMENSION)) {
    if (name.includes(key)) return val;
  }
  return 'optimize_engagement';
}

interface ContentCoachModalProps { open: boolean; onClose: () => void; }

export const ContentCoachModal: React.FC<ContentCoachModalProps> = ({ open, onClose }) => {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState<PostPreviewDimension[]>([]);
  const [overall, setOverall] = useState<number | null>(null);
  const [topTip, setTopTip] = useState('');
  const [error, setError] = useState('');
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixed, setFixed] = useState<Record<string, string>>({});

  const analyse = useCallback(async (text: string) => {
    setLoading(true); setError(''); setDimensions([]); setOverall(null); setFixed({});
    try {
      const res = await linkedInGrowthApi.getPostPreviewScore({ content: text });
      setOverall(res.overall_score);
      setDimensions(res.dimensions ?? []);
      setTopTip(res.top_improvement ?? '');
    } catch { setError('Could not analyse the draft. Please try again.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const d = readDraft();
    setDraft(d);
    if (d.trim()) { void analyse(d); }
  }, [open, analyse]);

  const handleFix = async (dim: PostPreviewDimension) => {
    const editType = guessEditType(dim);
    setFixing(dim.dimension); setError('');
    try {
      const res = await linkedInWriterApi.editContent({ content: draft, edit_type: editType });
      setFixed(prev => ({ ...prev, [dim.dimension]: res.content ?? '' }));
    } catch { setError('Fix failed. Please try again.'); }
    finally { setFixing(null); }
  };

  const hasDraft = draft.trim().length > 0;

  return (
    <DashboardActionModal open={open} title="Live Content Coach" onClose={onClose} maxWidth={580} maxHeight="min(92vh, 760px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
        AI analysis of your current draft — real-time scores across every quality dimension with one-click fixes.
      </p>

      {!hasDraft && !loading && (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✍️</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.textDark, marginBottom: 6 }}>No draft yet</div>
          <div style={{ fontSize: 13, color: C.textSecondary }}>Start writing in the editor, then come back for a real-time coaching session.</div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', justifyContent: 'center', color: C.textSecondary, fontSize: 13 }}>
          <Spinner /> Analysing your draft…
        </div>
      )}

      {error && <ErrorBanner msg={error} />}

      {overall !== null && !loading && (
        <>
          {/* Overall score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.rowBg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: scoreBg(overall), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: scoreColor(overall) }}>{overall}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.textDark, marginBottom: 3 }}>Overall Content Score</div>
              {topTip && <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>Top tip: {topTip}</div>}
            </div>
            <button type="button" onClick={() => void analyse(draft)} style={{ padding: '5px 10px', fontSize: 11, color: C.textTertiary, background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer' }}>
              ↻ Re-analyse
            </button>
          </div>

          {/* Dimension cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dimensions.map(dim => {
              const isFixing = fixing === dim.dimension;
              const fixedText = fixed[dim.dimension];
              return (
                <div key={dim.dimension} style={{ background: '#fff', border: `1.5px solid ${dim.score < 60 ? '#fca5a5' : C.border}`, borderLeft: `4px solid ${scoreColor(dim.score)}`, borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.textDark, textTransform: 'capitalize' }}>{dim.dimension}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, background: scoreBg(dim.score), color: scoreColor(dim.score), padding: '1px 7px', borderRadius: 4 }}>{dim.score}/100</span>
                      {dim.score < 75 && (
                        <button type="button" onClick={() => void handleFix(dim)} disabled={!!fixing}
                          style={{ padding: '3px 10px', background: isFixing ? C.primary : 'none', color: isFixing ? '#fff' : C.primary, border: `1.5px solid ${C.primary}`, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isFixing ? <><Spinner /> Fixing…</> : '⚡ Fix'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5, marginBottom: fixedText ? 8 : 0 }}>{dim.feedback}</div>
                  {fixedText && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '8px 10px', marginTop: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Fixed version</div>
                      <div style={{ fontSize: 11, color: '#14532d', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 6 }}>{fixedText.slice(0, 200)}{fixedText.length > 200 ? '…' : ''}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => { pushDraftToStudio(fixedText); onClose(); }}
                          style={{ padding: '4px 10px', background: C.primary, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          ✏️ Apply
                        </button>
                        <button type="button" onClick={() => { void navigator.clipboard.writeText(fixedText); }}
                          style={{ padding: '4px 8px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 11, color: C.textTertiary, cursor: 'pointer' }}>
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardActionModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// F2 — Quick-Start Wizard
// ─────────────────────────────────────────────────────────────────────────────

const GOALS = [
  { id: 'thought_leadership', label: 'Thought Leadership', icon: '🧠', desc: 'Share your expert insights and opinions', bestFormat: 'article', tone: 'authoritative' },
  { id: 'share_win',          label: 'Share a Win',        icon: '🏆', desc: 'Celebrate a milestone or success',       bestFormat: 'post',    tone: 'inspirational' },
  { id: 'educate',            label: 'Educate Followers',  icon: '📚', desc: 'Teach something valuable to your network', bestFormat: 'carousel', tone: 'educational' },
  { id: 'generate_leads',     label: 'Generate Leads',     icon: '🎯', desc: 'Drive inquiries and business interest',    bestFormat: 'post',    tone: 'professional' },
  { id: 'build_community',    label: 'Build Community',    icon: '🤝', desc: 'Start conversations and build connection', bestFormat: 'post',    tone: 'conversational' },
] as const;

const FORMAT_LABELS: Record<string, { icon: string; label: string; desc: string }> = {
  post:         { icon: '📝', label: 'LinkedIn Post',   desc: 'Short-form, high engagement' },
  article:      { icon: '📄', label: 'Article',         desc: 'Long-form thought leadership' },
  carousel:     { icon: '🎠', label: 'Carousel',        desc: 'Visual multi-slide storytelling' },
  video_script: { icon: '🎬', label: 'Video Script',    desc: 'Engaging hook + scenes' },
};

const FALLBACK_TOPICS: Record<string, string[]> = {
  thought_leadership: ['What I learned from my biggest mistake', 'Why most professionals overlook this skill', '5 contrarian ideas that changed how I work'],
  share_win:          ['Just hit a major milestone — here is what I learned', 'One year in — the honest story', 'We shipped it. Here is what the journey looked like'],
  educate:            ['A simple framework that will change how you think about X', '5 things nobody tells you about starting in this industry', 'Step-by-step: How I approach this every time'],
  generate_leads:     ['The problem we solve — and why it matters now', 'Is your team still doing this the hard way?', 'What our best clients have in common'],
  build_community:    ['Hot take: most advice on this topic is wrong', 'What is the one skill you wish you had started earlier?', 'Let us settle this debate — what do you think?'],
};

interface QuickStartWizardModalProps { open: boolean; onClose: () => void; }

export const QuickStartWizardModal: React.FC<QuickStartWizardModalProps> = ({ open, onClose }) => {
  const [step, setStep] = useState(1);
  const [goalId, setGoalId] = useState<string>('');
  const [format, setFormat] = useState<string>('');
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    if (!open) { setStep(1); setGoalId(''); setFormat(''); setTopics([]); }
  }, [open]);

  const handleGoalPick = (id: string) => {
    setGoalId(id);
    const goal = GOALS.find(g => g.id === id)!;
    setFormat(goal.bestFormat);
    // Try growth cache for trending topics
    const cache = readGrowthCache();
    const trending = cache?.trending?.trending_topics?.slice(0, 3).map(t => t.topic) ?? [];
    setTopics(trending.length >= 3 ? trending : FALLBACK_TOPICS[id] ?? FALLBACK_TOPICS.thought_leadership);
    setStep(2);
  };

  const handleFormatConfirm = () => setStep(3);

  const handleTopicPick = (topic: string) => {
    const goal = GOALS.find(g => g.id === goalId);
    window.dispatchEvent(new CustomEvent('linkedinwriter:openQuickCreate', {
      detail: { type: format, topic, tone: goal?.tone ?? 'professional' },
    }));
    onClose();
  };

  const goal = GOALS.find(g => g.id === goalId);
  const fmt = FORMAT_LABELS[format];

  const stepIndicator = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
      {[1, 2, 3].map(s => (
        <React.Fragment key={s}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= s ? C.primary : C.border, color: step >= s ? '#fff' : C.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{s}</div>
          {s < 3 && <div style={{ flex: 1, height: 2, background: step > s ? C.primary : C.border }} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <DashboardActionModal open={open} title="Quick-Start Wizard" onClose={onClose} maxWidth={540} maxHeight="min(92vh, 680px)">
      {stepIndicator}

      {step === 1 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.textDark, marginBottom: 6 }}>What is your goal today?</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Pick your intent — the wizard will suggest the best format and topic ideas.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GOALS.map(g => (
              <button key={g.id} type="button" onClick={() => handleGoalPick(g.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', border: `2px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{g.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.textDark }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary }}>{g.desc}</div>
                </div>
                <span style={{ marginLeft: 'auto', color: C.textTertiary, fontSize: 16 }}>›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && goal && fmt && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.textDark, marginBottom: 4 }}>Best format for your goal</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
            For <strong>{goal.label}</strong>, we recommend:
          </div>
          <div style={{ background: '#eff6ff', border: `2px solid ${C.primary}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 28 }}>{fmt.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.textDark }}>{fmt.label}</div>
                <div style={{ fontSize: 12, color: C.textSecondary }}>{fmt.desc}</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 16 }}>Want a different format?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {Object.entries(FORMAT_LABELS).map(([fid, f]) => (
              <button key={fid} type="button" onClick={() => setFormat(fid)}
                style={{ padding: '6px 12px', background: format === fid ? C.primary : 'none', color: format === fid ? '#fff' : C.textSecondary, border: `1.5px solid ${format === fid ? C.primary : C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setStep(1)} style={{ padding: '9px 16px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.textSecondary, cursor: 'pointer' }}>
              ← Back
            </button>
            <button type="button" onClick={handleFormatConfirm} style={{ flex: 1, padding: '9px', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Continue with {fmt.label} →
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.textDark, marginBottom: 4 }}>Pick a topic to start</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>AI-sourced ideas based on what is trending for your audience. One click to pre-fill the creator.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {topics.map((topic, i) => (
              <button key={i} type="button" onClick={() => handleTopicPick(topic)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', border: `2px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
                <div style={{ flex: 1, fontSize: 13, color: C.textDark, fontWeight: 600 }}>{topic}</div>
                <span style={{ color: C.primary, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Create →</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep(2)} style={{ fontSize: 12, color: C.textTertiary, background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Change format
          </button>
        </>
      )}
    </DashboardActionModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// F3 — LinkedIn Best Practices Panel
// ─────────────────────────────────────────────────────────────────────────────

type BpTab = 'post' | 'article' | 'carousel' | 'video';

interface BpRule { rule: string; detail: string; examplePrompt?: string; }

const BP_RULES: Record<BpTab, BpRule[]> = {
  post: [
    { rule: 'Stay under 1,300 characters', detail: 'Posts over 1,300 chars are truncated with a "see more" break. Frontload your hook in the first 2 lines.', examplePrompt: 'Write a punchy LinkedIn post under 1300 characters about the future of remote work.' },
    { rule: 'Use 3–5 hashtags maximum', detail: 'More than 5 hashtags signal spam to the algorithm. Place them at the end, never inline.', examplePrompt: 'Write a LinkedIn post with exactly 3 relevant hashtags at the end about leadership.' },
    { rule: 'Start with a bold hook', detail: 'The first line determines if readers click "see more". Use a surprising stat, a question, or a counterintuitive claim.', examplePrompt: 'Write a LinkedIn post that starts with a surprising stat hook about AI in the workplace.' },
    { rule: 'End with a clear CTA', detail: 'Ask a specific question or invite a reaction. Posts that drive comments get algorithmic boosts.', examplePrompt: 'Write a LinkedIn post that ends with a strong engagement question about team culture.' },
    { rule: 'Post Tuesday–Thursday, 8–10 AM', detail: 'LinkedIn engagement peaks mid-week mornings. Avoid Mondays and Fridays for maximum reach.' },
    { rule: 'Use line breaks for readability', detail: 'Short paragraphs (1–2 sentences) separated by blank lines increase read-through rates significantly.' },
  ],
  article: [
    { rule: 'Aim for 1,500–2,000 words', detail: 'LinkedIn articles under 1,500 words rarely rank in search. Over 3,000 words reduces read-through rate.' },
    { rule: 'Include a keyword-rich headline', detail: 'Articles are indexed by LinkedIn search. Place your main topic keyword in the first 5 words of the title.', examplePrompt: 'Write a LinkedIn article headline about building resilience in remote teams with strong SEO.' },
    { rule: 'Use H2 subheadings every 300 words', detail: 'Subheadings improve skimmability and signal structure to readers who scan before committing.' },
    { rule: 'Cite data and sources', detail: 'Articles with cited statistics are shared 3× more than opinion-only pieces.' },
    { rule: 'End with an author bio paragraph', detail: 'Readers who reach the end are warm prospects. Mention your expertise and a soft CTA to connect.' },
  ],
  carousel: [
    { rule: 'Keep slides to 8–12', detail: 'Fewer than 6 slides feels thin; more than 15 loses readers. The sweet spot is 8–10 slides with one idea per slide.', examplePrompt: 'Create a 8-slide LinkedIn carousel outline about the 5-step framework for better decision-making.' },
    { rule: 'Slide 1 is your hook', detail: 'The cover slide must promise a clear benefit. Use "How to…", "X mistakes…", or "The _ framework" formats.' },
    { rule: 'One idea per slide', detail: 'Each slide should contain one headline + one supporting point. Do not crowd slides with text.' },
    { rule: 'Last slide = CTA', detail: 'Your final slide should invite the viewer to follow, comment, or save the carousel.' },
    { rule: 'Consistent visual style', detail: 'Use the same font, palette, and logo placement on every slide. Inconsistency signals low effort.' },
  ],
  video: [
    { rule: 'Hook in the first 3 seconds', detail: 'LinkedIn auto-plays without sound. Use bold text overlays or an expressive face in the first frame.', examplePrompt: 'Write a LinkedIn video script hook (first 3 seconds) about why most meetings are a waste of time.' },
    { rule: 'Keep it under 2 minutes', detail: 'LinkedIn videos over 2 minutes see a sharp drop in completion rate. For educational content, 60–90 seconds is optimal.' },
    { rule: 'Include captions', detail: '85% of LinkedIn videos are watched without sound. Captions increase watch-through by up to 40%.' },
    { rule: 'Vertical or square format', detail: '1:1 (square) or 9:16 (vertical) videos take up more screen space in the feed and get more impressions than 16:9.' },
    { rule: 'End with one clear ask', detail: 'Say one thing you want viewers to do: follow, comment a specific word, or click a link. One CTA beats three.' },
  ],
};

const TAB_META: Record<BpTab, { icon: string; label: string; color: string }> = {
  post:     { icon: '📝', label: 'Post',    color: '#0a66c2' },
  article:  { icon: '📄', label: 'Article', color: '#057642' },
  carousel: { icon: '🎠', label: 'Carousel', color: '#8b5cf6' },
  video:    { icon: '🎬', label: 'Video',   color: '#dc2626' },
};

interface BestPracticesModalProps { open: boolean; onClose: () => void; }

export const BestPracticesModal: React.FC<BestPracticesModalProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState<BpTab>('post');
  const [generating, setGenerating] = useState<string | null>(null);
  const [example, setExample] = useState<Record<string, string>>({});
  const [exError, setExError] = useState('');
  const [viralPatterns, setViralPatterns] = useState<{ name: string; desc: string; example: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    const cache = readGrowthCache();
    if (cache?.viral_analysis?.patterns) {
      setViralPatterns(
        cache.viral_analysis.patterns.slice(0, 3).map(p => ({
          name: p.pattern_name,
          desc: p.description,
          example: p.example_headline,
        }))
      );
    }
  }, [open]);

  const handleShowExample = async (rule: BpRule) => {
    if (!rule.examplePrompt) return;
    const key = rule.rule;
    setGenerating(key); setExError('');
    try {
      const res = await linkedInWriterApi.generatePost({ topic: rule.examplePrompt, industry: '' });
      const content = res.data?.content ?? '';
      setExample(prev => ({ ...prev, [key]: content }));
    } catch { setExError('Could not generate example. Please try again.'); }
    finally { setGenerating(null); }
  };

  const meta = TAB_META[tab];

  return (
    <DashboardActionModal open={open} title="LinkedIn Best Practices" onClose={onClose} maxWidth={600} maxHeight="min(92vh, 780px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
        Format-specific playbook with the rules that drive results on LinkedIn. Click "See Example" for an AI-generated demo.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: `2px solid ${C.border}`, paddingBottom: 10 }}>
        {(Object.keys(TAB_META) as BpTab[]).map(t => {
          const m = TAB_META[t];
          const isActive = tab === t;
          return (
            <button key={t} type="button" onClick={() => setTab(t)}
              style={{ padding: '6px 12px', background: isActive ? m.color : 'none', color: isActive ? '#fff' : C.textSecondary, border: `1.5px solid ${isActive ? m.color : C.border}`, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              {m.icon} {m.label}
            </button>
          );
        })}
      </div>

      {exError && <ErrorBanner msg={exError} />}

      {/* Rules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BP_RULES[tab].map((rule, i) => {
          const key = rule.rule;
          const isGenerating = generating === key;
          const exampleText = example[key];
          return (
            <div key={i} style={{ background: C.rowBg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${meta.color}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.textDark, marginBottom: 3 }}>{rule.rule}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{rule.detail}</div>
                </div>
                {rule.examplePrompt && (
                  <button type="button" onClick={() => void handleShowExample(rule)} disabled={!!generating}
                    style={{ padding: '4px 10px', background: isGenerating ? meta.color : 'none', color: isGenerating ? '#fff' : meta.color, border: `1.5px solid ${meta.color}`, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isGenerating ? <><Spinner /> Generating…</> : '✨ See Example'}
                  </button>
                )}
              </div>
              {exampleText && (
                <div style={{ background: '#fff', border: `1px solid ${meta.color}44`, borderRadius: 6, padding: '8px 10px', marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 6 }}>{exampleText.slice(0, 300)}{exampleText.length > 300 ? '…' : ''}</div>
                  <button type="button" onClick={() => { pushDraftToStudio(exampleText); onClose(); }}
                    style={{ padding: '4px 10px', background: meta.color, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Use This
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Viral patterns from cache */}
      {viralPatterns.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Viral Patterns in Your Industry
          </div>
          {viralPatterns.map((vp, i) => (
            <div key={i} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#6d28d9', marginBottom: 3 }}>{vp.name}</div>
              <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>{vp.desc}</div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: '#7c3aed', marginBottom: 8, background: '#ede9fe', padding: '4px 8px', borderRadius: 4 }}>e.g. "{vp.example}"</div>
              <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('linkedinwriter:openQuickCreate', { detail: { type: 'post', topic: vp.example } })); onClose(); }}
                style={{ padding: '4px 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                ✍️ Write in This Style
              </button>
            </div>
          ))}
        </div>
      )}
    </DashboardActionModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// F4 — Interactive Feature Map
// ─────────────────────────────────────────────────────────────────────────────

const AI_CAPABILITIES = [
  { id: 'factCheck',   icon: '🔍', title: 'Fact Check',       desc: 'Verify every claim against live web sources before publishing. Select any text while writing to run it.', color: '#6366f1' },
  { id: 'liveResearch', icon: '🌐', title: 'Live Web Research', desc: 'Pull real-time data, stats, and sources into your draft. Toggle in the editor while writing.', color: '#0ea5e9' },
  { id: 'persona',     icon: '👤', title: 'Persona Writing',   desc: 'Every piece of content is shaped by your brand voice, industry, and target audience from your profile.', color: '#ec4899' },
  { id: 'assistive',   icon: '✍️', title: 'Assistive Writing', desc: 'Inline AI suggestions appear as you type, offering phrasing alternatives and grounded citations.', color: '#f97316' },
];

const WHEN_TO_USE: Record<string, string> = {
  plan:       'When you need inspiration or topic research before writing',
  create:     'When you are ready to generate a post, article, carousel, or video script',
  publish:    'When your content is drafted and needs to be reviewed, scheduled, or published',
  analysis:   'When you want to understand your brand performance, content gaps, or viral trends',
  engagement: 'When you want to boost replies, find conversations, or grow your network',
  remarket:   'When you want to repurpose or refresh high-performing past content',
};

interface FeatureMapModalProps { open: boolean; onClose: () => void; onOpenWedge: (id: string) => void; onOpenCapability: (id: string) => void; }

export const FeatureMapModal: React.FC<FeatureMapModalProps> = ({ open, onClose, onOpenWedge, onOpenCapability }) => (
  <DashboardActionModal open={open} title="Studio Feature Map" onClose={onClose} maxWidth={680} maxHeight="min(92vh, 780px)">
    <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
      Everything LinkedIn Studio can do — in one place. Click any card to jump straight to it.
    </p>

    {/* Workflow Wedges */}
    <div style={{ fontSize: 11, fontWeight: 800, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
      Workflow Wedges
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
      {DASHBOARD_WORKFLOW_CARDS.map(card => (
        <div key={card.id} style={{ background: '#fff', border: `1.5px solid ${card.accent}44`, borderLeft: `4px solid ${card.accent}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{ fontSize: 18 }}>{card.icon}</span>
            <div style={{ fontWeight: 800, fontSize: 13, color: C.textDark }}>{card.title}</div>
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.4, marginBottom: 8 }}>{card.description}</div>
          <div style={{ fontSize: 10, fontStyle: 'italic', color: C.textTertiary, background: C.badgeBg, padding: '3px 7px', borderRadius: 4, marginBottom: 8, lineHeight: 1.4 }}>
            {WHEN_TO_USE[card.id]}
          </div>
          <button type="button" onClick={() => { onOpenWedge(card.id); onClose(); }}
            style={{ padding: '4px 12px', background: card.accent, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Open {card.title} →
          </button>
        </div>
      ))}
    </div>

    {/* AI Capabilities */}
    <div style={{ fontSize: 11, fontWeight: 800, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
      AI Superpowers
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
      {AI_CAPABILITIES.map(cap => (
        <div key={cap.id} style={{ background: C.rowBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{ fontSize: 18 }}>{cap.icon}</span>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.textDark }}>{cap.title}</div>
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.4, marginBottom: 8 }}>{cap.desc}</div>
          <button type="button" onClick={() => { onOpenCapability(cap.id); onClose(); }}
            style={{ padding: '4px 10px', background: cap.color, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Try Now →
          </button>
        </div>
      ))}
    </div>

    {/* Footer: Replay Tour */}
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', justifyContent: 'center' }}>
      <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('linkedinwriter:startStudioTour')); onClose(); }}
        style={{ padding: '9px 24px', background: 'none', border: `2px solid ${C.primary}`, borderRadius: 8, color: C.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        ▶ Replay Studio Tour
      </button>
    </div>
  </DashboardActionModal>
);

// ─────────────────────────────────────────────────────────────────────────────
// F5 — Ask ALwrity (LinkedIn Q&A)
// ─────────────────────────────────────────────────────────────────────────────

interface FaqItem { q: string; a: string; }

const FAQ_ITEMS: FaqItem[] = [
  { q: 'What is the ideal LinkedIn post length?', a: 'The sweet spot is 150–300 words (roughly 900–1,800 characters). Short posts under 5 lines get the most impressions; longer posts with storytelling get the most comments. Avoid the "see more" cut-off around line 3 by making your first two lines irresistible.' },
  { q: 'How many hashtags should I use?', a: 'Use 3–5 hashtags per post. More than 5 can signal spam. Use 1 broad hashtag (#leadership), 1 niche hashtag (#B2BSales), and 1 community hashtag (#LinkedInTips). Place them at the end of your post, never inline.' },
  { q: 'What is the best time to post on LinkedIn?', a: 'Peak engagement is Tuesday–Thursday, 7–9 AM or 5–6 PM in your audience\'s local time. Avoid Monday mornings (inbox overwhelm) and Friday afternoons (checked out). Consistency matters more than timing — pick a slot and stick to it.' },
  { q: 'How do I write a strong LinkedIn hook?', a: 'The first 2 lines must stop the scroll. Three proven formulas: (1) Surprising stat: "90% of managers never do this." (2) Contrarian take: "Stop sending LinkedIn voice notes." (3) Open loop: "I got fired. Best thing that ever happened." Avoid starting with "I" — it signals self-focus.' },
  { q: 'How often should I post on LinkedIn?', a: '3–5 times per week is the recommended cadence for consistent growth. Posting daily leads to faster audience fatigue. Quality over quantity — one exceptional post beats five mediocre ones. Aim for 1 long-form post + 2 conversational posts per week.' },
  { q: 'What content formats get the most reach?', a: 'Carousels get 3× more reach than text posts. Native videos get 5× more reach than shared links. Document posts (PDFs) appear large in the feed. Text-only posts with great storytelling outperform image posts. Never post external links directly — put them in the first comment.' },
  { q: 'How do I increase engagement on my posts?', a: 'End every post with a specific, easy-to-answer question ("What would you add?"). Reply to every comment within the first hour — early engagement signals the algorithm. Tag relevant people only when it adds value. Use "you" more than "I" — write to your reader, not about yourself.' },
  { q: 'Should I put links in LinkedIn posts?', a: 'Never put links in the post body — LinkedIn suppresses reach for outbound links. Instead: write the full post, and in the first comment write "Full article here: [link]". Then immediately like your own comment to pin it to the top. This preserves reach while driving clicks.' },
];

interface AskAlwrityModalProps { open: boolean; onClose: () => void; }

export const AskAlwrityModal: React.FC<AskAlwrityModalProps> = ({ open, onClose }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState('');
  const [askError, setAskError] = useState('');

  useEffect(() => {
    if (!open) { setOpenFaq(null); setQuestion(''); setAnswer(''); setAskError(''); }
  }, [open]);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true); setAnswer(''); setAskError('');
    try {
      const prompt = `You are a LinkedIn content expert. Answer this question concisely and practically (2-4 sentences with specific numbers where relevant): "${question}"`;
      const res = await linkedInWriterApi.generatePost({ topic: prompt, industry: '', max_length: 300 });
      setAnswer(res.data?.content ?? 'Sorry, I could not generate an answer. Please try again.');
    } catch { setAskError('Could not get an answer. Please try again.'); }
    finally { setAsking(false); }
  };

  return (
    <DashboardActionModal open={open} title="Ask ALwrity" onClose={onClose} maxWidth={560} maxHeight="min(92vh, 760px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
        LinkedIn questions answered instantly — from the most common ones to whatever is on your mind right now.
      </p>

      {/* FAQ Accordion */}
      <div style={{ fontSize: 11, fontWeight: 800, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Top LinkedIn Questions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openFaq === i;
          return (
            <div key={i} style={{ background: isOpen ? '#eff6ff' : C.rowBg, border: `1px solid ${isOpen ? '#bfdbfe' : C.border}`, borderRadius: 8, overflow: 'hidden', transition: 'background 0.15s' }}>
              <button type="button" onClick={() => setOpenFaq(isOpen ? null : i)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isOpen ? C.primary : C.textDark, flex: 1 }}>{item.q}</span>
                <span style={{ color: isOpen ? C.primary : C.textTertiary, fontSize: 14, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 12px 12px', fontSize: 12, color: C.textBody, lineHeight: 1.65 }}>
                  {item.a}
                  <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(item.a); }}
                      style={{ padding: '3px 9px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 10, color: C.textTertiary, cursor: 'pointer' }}>
                      📋 Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Free-text Q&A */}
      <div style={{ fontSize: 11, fontWeight: 800, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Ask Your Own Question
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !asking) void handleAsk(); }}
          placeholder="e.g. How do I grow my LinkedIn following fast?"
          style={{ flex: 1, padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.textDark, fontFamily: 'inherit', outline: 'none' }}
        />
        <button type="button" onClick={() => void handleAsk()} disabled={asking || !question.trim()}
          style={{ padding: '9px 16px', background: question.trim() && !asking ? C.primary : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: question.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
          {asking ? <><Spinner /> Asking…</> : 'Ask'}
        </button>
      </div>

      {askError && <ErrorBanner msg={askError} />}

      {answer && (
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 6 }}>ALwrity says:</div>
          <div style={{ fontSize: 13, color: C.textBody, lineHeight: 1.65, marginBottom: 10 }}>{answer}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { pushDraftToStudio(answer); onClose(); }}
              style={{ padding: '5px 12px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ Copy to Draft
            </button>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(answer); }}
              style={{ padding: '5px 9px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.textTertiary, cursor: 'pointer' }}>
              📋
            </button>
          </div>
        </div>
      )}
    </DashboardActionModal>
  );
};
