/**
 * Remarket Wedge — 5 AI-first feature modals (priority order)
 *
 * R1  RepurposeLabModal       — top 3 posts by engagement rate, 4 repurpose CTAs each
 * R2  FormatTransformerModal  — current draft → Article / Carousel / Video Script
 * R3  ContentRefreshModal     — last 5 posts with 7 one-click edit transforms
 * R4  StaleReviverModal       — buried high-performing posts, Update & New Angle CTAs
 * R5  PerfToPlanModal         — extract winning topics, generate 5 remix ideas
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import {
  postAnalyticsApi,
  type LinkedInPost,
} from '../../../../services/postAnalyticsApi';
import {
  linkedInWriterApi,
  saveLinkedInToAssetLibrary,
  type LinkedInEditContentRequest,
} from '../../../../services/linkedInWriterApi';
import { colors, rowBase } from '../GrowthEngine/styles';

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'alwrity-copilot-draft-content';
const POSTS_CACHE_KEY = 'rw_posts_cache';
const POSTS_CACHE_TTL = 10 * 60 * 1000; // 10 min

interface PostsCache { posts: LinkedInPost[]; ts: number; }

function readDraft(): string {
  try { return localStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
}

function pushDraftToStudio(text: string) {
  window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: text }));
}

function openInCreate(type: string, topic: string, keyPoints: string) {
  window.dispatchEvent(new CustomEvent('linkedinwriter:openQuickCreate', {
    detail: { type, topic, key_points: keyPoints },
  }));
}

function readPostsCache(): LinkedInPost[] | null {
  try {
    const raw = sessionStorage.getItem(POSTS_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as PostsCache;
    if (Date.now() - c.ts > POSTS_CACHE_TTL) return null;
    return c.posts;
  } catch { return null; }
}

function writePostsCache(posts: LinkedInPost[]) {
  try { sessionStorage.setItem(POSTS_CACHE_KEY, JSON.stringify({ posts, ts: Date.now() })); } catch { /* full */ }
}

function postSnippet(text: string, max = 100): string {
  return text.length <= max ? text : text.slice(0, max) + '…';
}

function extractTopics(posts: LinkedInPost[]): string[] {
  const words = posts
    .flatMap(p => p.text.split(/\s+/).slice(0, 20))
    .filter(w => w.length > 4 && !/^(https?|www\.|#)/.test(w))
    .map(w => w.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase());
  const freq: Record<string, number> = {};
  for (const w of words) { freq[w] = (freq[w] ?? 0) + 1; }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
}

function engagementScore(p: LinkedInPost): number {
  const m = p.engagement;
  return (m.engagement_rate ?? 0) * 1000 + (m.reactions ?? 0) + (m.comments ?? 0) * 2;
}

function formatRate(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

function ageInDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

const Spinner = () => (
  <>
    <style>{`@keyframes rw-spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #d1d5db', borderTopColor: colors.primary, borderRadius: '50%', animation: 'rw-spin 0.7s linear infinite', flexShrink: 0 }} />
  </>
);

const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{msg}</div>
);

const LoadingRow: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>
    <Spinner /> {message}
  </div>
);

const EmptyPrompt: React.FC<{ icon: string; title: string; desc: string; btnLabel?: string; onLoad?: () => void; loading?: boolean }> = ({ icon, title, desc, btnLabel, onLoad, loading }) => (
  <div style={{ textAlign: 'center', padding: '24px 0' }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: onLoad ? 20 : 0 }}>{desc}</div>
    {onLoad && (
      <button type="button" disabled={loading} onClick={onLoad} style={{ marginTop: 12, padding: '10px 24px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {loading ? <><Spinner /> Loading…</> : btnLabel}
      </button>
    )}
  </div>
);

const MetricPill: React.FC<{ icon: string; value: number; label: string }> = ({ icon, value, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: colors.textSecondary }}>
    <span>{icon}</span>
    <strong style={{ color: colors.textDark }}>{value.toLocaleString()}</strong>
    <span style={{ color: colors.textTertiary }}>{label}</span>
  </span>
);

const SavedBadge = () => (
  <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 4 }}>✓ Saved</span>
);

// Shared hook to load posts (with session cache)
function usePosts(open: boolean, limit = 10) {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = readPostsCache();
      if (cached) { setPosts(cached); return; }
    }
    setLoading(true); setError('');
    try {
      const res = await postAnalyticsApi.fetchPosts({ limit });
      const loaded = res.posts ?? [];
      writePostsCache(loaded);
      setPosts(loaded);
    } catch { setError('Could not load posts. Make sure LinkedIn is connected.'); }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { if (open) { void load(); } }, [open, load]);

  return { posts, loading, error, reload: () => void load(true) };
}

// ─────────────────────────────────────────────────────────────────────────────
// R1 — Top Performers Repurpose Lab
// ─────────────────────────────────────────────────────────────────────────────

interface RepurposeLabModalProps { open: boolean; onClose: () => void; }

const REPURPOSE_ACTIONS = [
  { type: 'carousel',     icon: '🎠', label: 'Carousel',     accent: '#8b5cf6' },
  { type: 'article',      icon: '📄', label: 'Article',      accent: '#057642' },
  { type: 'video_script', icon: '🎬', label: 'Video Script', accent: '#dc2626' },
  { type: 'post',         icon: '✍️', label: 'New Angle',    accent: '#0a66c2' },
];

export const RepurposeLabModal: React.FC<RepurposeLabModalProps> = ({ open, onClose }) => {
  const { posts, loading, error, reload } = usePosts(open);
  const topPosts = useMemo(() =>
    [...posts].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 3),
    [posts]
  );

  return (
    <DashboardActionModal open={open} title="Top Performers Repurpose Lab" onClose={onClose} maxWidth={600} maxHeight="min(92vh, 740px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        Your best-performing posts, ready to transform into new formats. One click to repurpose a winner.
      </p>

      {loading && <LoadingRow message="Fetching your top posts from LinkedIn…" />}
      {error && <ErrorBanner msg={error} />}
      {!loading && !error && posts.length === 0 && (
        <EmptyPrompt icon="♻️" title="No posts found" desc="Connect LinkedIn and publish at least one post to see your top performers." btnLabel="Retry" onLoad={reload} />
      )}

      {!loading && topPosts.map((post, idx) => (
        <TopPerformerCard key={post.id} post={post} rank={idx + 1} onRepurpose={(type) => { openInCreate(type, post.title ?? 'My Post', post.text); onClose(); }} />
      ))}

      {!loading && topPosts.length > 0 && (
        <div style={{ marginTop: 6, textAlign: 'center' }}>
          <button type="button" onClick={reload} style={{ fontSize: 12, color: colors.textTertiary, background: 'none', border: 'none', cursor: 'pointer' }}>
            ↻ Refresh posts
          </button>
        </div>
      )}
    </DashboardActionModal>
  );
};

const TopPerformerCard: React.FC<{ post: LinkedInPost; rank: number; onRepurpose: (type: string) => void }> = ({ post, rank, onRepurpose }) => {
  const rankColors = [
    { border: '#f59e0b', badge: '#fef9c3', text: '#854d0e' },
    { border: '#94a3b8', badge: '#f1f5f9', text: '#475569' },
    { border: '#b45309', badge: '#fef3c7', text: '#92400e' },
  ];
  const rc = rankColors[rank - 1] ?? rankColors[2];
  const m = post.engagement;

  return (
    <div style={{ ...rowBase, marginBottom: 12, borderLeft: `3px solid ${rc.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 800, background: rc.badge, color: rc.text, padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>#{rank}</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {postSnippet(post.text, 90)}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatRate(m.engagement_rate ?? 0)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <MetricPill icon="❤️" value={m.reactions ?? 0} label="reactions" />
        <MetricPill icon="💬" value={m.comments ?? 0} label="comments" />
        <MetricPill icon="🔁" value={m.reposts ?? 0} label="reposts" />
        <MetricPill icon="👁️" value={m.impressions ?? 0} label="views" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {REPURPOSE_ACTIONS.map(a => (
          <button key={a.type} type="button" onClick={() => onRepurpose(a.type)}
            style={{ padding: '5px 12px', background: a.type === 'post' ? 'none' : a.accent, color: a.type === 'post' ? a.accent : '#fff', border: `1.5px solid ${a.accent}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// R2 — Format Transformer
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  { type: 'article',      icon: '📄', label: 'Article',      desc: 'Long-form thought leadership piece',    accent: '#057642' },
  { type: 'carousel',     icon: '🎠', label: 'Carousel',     desc: 'Visual slide deck (5-8 slides)',        accent: '#8b5cf6' },
  { type: 'video_script', icon: '🎬', label: 'Video Script', desc: 'Hook, main content, CTA',              accent: '#dc2626' },
] as const;

type FormatType = typeof FORMAT_OPTIONS[number]['type'];

interface FormatTransformerModalProps { open: boolean; onClose: () => void; }

export const FormatTransformerModal: React.FC<FormatTransformerModalProps> = ({ open, onClose }) => {
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState<FormatType | null>(null);
  const [result, setResult] = useState<{ type: FormatType; content: string; title: string } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(readDraft());
    setResult(null); setError(''); setSaved(false);
  }, [open]);

  const handleTransform = async (type: FormatType) => {
    if (!draft.trim()) { setError('Please write or paste a post first.'); return; }
    setGenerating(type); setError(''); setResult(null);
    try {
      const topic = draft.slice(0, 80).replace(/\n/g, ' ').trim();
      let content = '';
      let title = '';

      if (type === 'article') {
        const res = await linkedInWriterApi.generateArticle({ topic, industry: '', key_sections: [draft] });
        if (!res.success || !res.data) throw new Error(res.error ?? 'Generation failed');
        title = res.data.title;
        content = `# ${res.data.title}\n\n${res.data.content}`;
      } else if (type === 'carousel') {
        const res = await linkedInWriterApi.generateCarousel({ topic, industry: '', key_takeaways: [draft] });
        if (!res.success || !res.data) throw new Error(res.error ?? 'Generation failed');
        title = res.data.title;
        content = [
          `# ${res.data.title}`,
          ...(res.data.slides ?? []).map(s => `**Slide ${s.slide_number}: ${s.title}**\n${s.content}`),
        ].join('\n\n');
      } else {
        const res = await linkedInWriterApi.generateVideoScript({ topic, industry: '', key_messages: [draft] });
        if (!res.success || !res.data) throw new Error(res.error ?? 'Generation failed');
        title = 'Video Script';
        content = [
          `🎬 Hook: ${res.data.hook}`,
          '',
          res.data.main_content.map((s, i) => `Scene ${i + 1}: ${JSON.stringify(s)}`).join('\n'),
          '',
          `✅ Conclusion: ${res.data.conclusion}`,
          '',
          `📝 Description: ${res.data.video_description}`,
        ].join('\n');
      }
      setResult({ type, content, title });
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed. Please try again.');
    } finally { setGenerating(null); }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await saveLinkedInToAssetLibrary({ title: result.title || 'Transformed Content', content: result.content, topic: result.title, tags: [result.type] });
      setSaved(true);
    } catch { setError('Could not save to library.'); }
  };

  const fmt = FORMAT_OPTIONS.find(f => f.type === result?.type);

  return (
    <DashboardActionModal open={open} title="Format Transformer" onClose={onClose} maxWidth={600} maxHeight="min(92vh, 780px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        Transform your post or draft into a completely different format. Auto-fills from your current draft.
      </p>

      {!result && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMedium, marginBottom: 6 }}>Your Post / Draft</div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Paste your post here, or open the editor first to auto-fill…"
            style={{ width: '100%', minHeight: 100, padding: '9px 11px', borderRadius: 8, border: `1.5px solid ${colors.border}`, fontSize: 12, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, color: colors.textBody, boxSizing: 'border-box', marginBottom: 12 }}
          />

          {error && <ErrorBanner msg={error} />}

          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMedium, marginBottom: 8 }}>Transform to:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {FORMAT_OPTIONS.map(f => (
              <button key={f.type} type="button" onClick={() => void handleTransform(f.type)} disabled={!!generating || !draft.trim()}
                style={{ padding: '14px 10px', background: generating === f.type ? f.accent : `${f.accent}15`, border: `2px solid ${generating === f.type ? f.accent : `${f.accent}55`}`, borderRadius: 10, cursor: draft.trim() ? 'pointer' : 'default', opacity: !draft.trim() ? 0.5 : 1, textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: generating === f.type ? '#fff' : f.accent, marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: generating === f.type ? '#ffffffcc' : colors.textTertiary, lineHeight: 1.3 }}>{f.desc}</div>
                {generating === f.type && (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 11, color: '#fff' }}>
                    <Spinner /> Generating…
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {result && fmt && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>{fmt.icon}</span>
            <div style={{ fontWeight: 700, fontSize: 14, color: colors.textDark }}>{result.title || fmt.label}</div>
            {saved && <SavedBadge />}
          </div>

          <div style={{ background: colors.rowBg, border: `1.5px solid ${fmt.accent}44`, borderLeft: `4px solid ${fmt.accent}`, borderRadius: 8, padding: '12px 14px', maxHeight: 280, overflowY: 'auto', fontSize: 12, color: colors.textBody, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
            {result.content}
          </div>

          {error && <ErrorBanner msg={error} />}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { pushDraftToStudio(result.content); onClose(); }}
              style={{ flex: 1, padding: '9px', background: fmt.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ Edit in Studio
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saved}
              style={{ padding: '9px 16px', background: saved ? '#dcfce7' : 'none', color: saved ? '#166534' : colors.textSecondary, border: `1.5px solid ${saved ? '#86efac' : colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saved ? 'default' : 'pointer' }}>
              {saved ? '✓ Saved' : '💾 Save to Library'}
            </button>
            <button type="button" onClick={() => { setResult(null); setSaved(false); }}
              style={{ padding: '9px 14px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12, color: colors.textTertiary, cursor: 'pointer' }}>
              ↩ Try Another
            </button>
          </div>
        </>
      )}
    </DashboardActionModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// R3 — Content Refresh Studio
// ─────────────────────────────────────────────────────────────────────────────

const EDIT_ACTIONS: { type: LinkedInEditContentRequest['edit_type']; icon: string; label: string; color: string }[] = [
  { type: 'optimize_engagement', icon: '⚡', label: 'Boost',        color: '#f59e0b' },
  { type: 'professionalize',     icon: '💼', label: 'Professionalise', color: '#0a66c2' },
  { type: 'add_cta',             icon: '📣', label: 'Add CTA',      color: '#059669' },
  { type: 'add_hashtags',        icon: '#️⃣', label: 'Hashtags',    color: '#8b5cf6' },
  { type: 'expand',              icon: '↕',  label: 'Expand',       color: '#0ea5e9' },
  { type: 'condense',            icon: '↙',  label: 'Condense',     color: '#dc2626' },
  { type: 'adjust_tone',         icon: '🎭', label: 'Tone',         color: '#475569' },
];

interface ContentRefreshModalProps { open: boolean; onClose: () => void; }

export const ContentRefreshModal: React.FC<ContentRefreshModalProps> = ({ open, onClose }) => {
  const { posts, loading, error, reload } = usePosts(open, 5);
  const [activePost, setActivePost] = useState<string | null>(null);
  const [transforming, setTransforming] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { editType: string; before: string; after: string }>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [transformError, setTransformError] = useState('');

  useEffect(() => { if (open) { setActivePost(null); setResults({}); setSaved({}); } }, [open]);

  const handleTransform = async (post: LinkedInPost, editType: LinkedInEditContentRequest['edit_type']) => {
    const key = `${post.id}_${editType}`;
    setTransforming(key); setTransformError('');
    try {
      const res = await linkedInWriterApi.editContent({ content: post.text, edit_type: editType });
      setResults(prev => ({ ...prev, [key]: { editType, before: post.text, after: res.content ?? '' } }));
      setActivePost(post.id);
    } catch { setTransformError('Transform failed. Please try again.'); }
    finally { setTransforming(null); }
  };

  const handleSave = async (key: string, after: string, postId: string) => {
    try {
      await saveLinkedInToAssetLibrary({ title: `Refreshed LinkedIn Post`, content: after, tags: ['refreshed'] });
      setSaved(prev => ({ ...prev, [key]: true }));
    } catch { setTransformError('Could not save.'); }
  };

  const recentPosts = posts.slice(0, 5);

  return (
    <DashboardActionModal open={open} title="Content Refresh Studio" onClose={onClose} maxWidth={620} maxHeight="min(92vh, 780px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        Pick any recent post and apply one of 7 AI transforms in a single click — then copy, edit, or save.
      </p>

      {loading && <LoadingRow message="Loading your recent posts…" />}
      {error && <ErrorBanner msg={error} />}
      {transformError && <ErrorBanner msg={transformError} />}
      {!loading && !error && recentPosts.length === 0 && (
        <EmptyPrompt icon="📝" title="No posts found" desc="Connect LinkedIn to see your recent posts here." btnLabel="Retry" onLoad={reload} />
      )}

      {!loading && recentPosts.map(post => {
        const isActive = activePost === post.id;
        const engRate = formatRate(post.engagement?.engagement_rate ?? 0);
        const isLow = (post.engagement?.engagement_rate ?? 0) < 0.02;
        return (
          <div key={post.id} style={{ ...rowBase, marginBottom: 10, borderLeft: `3px solid ${isLow ? '#f59e0b' : colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.textDark, flex: 1, lineHeight: 1.4 }}>
                {postSnippet(post.text, 80)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {isLow && <span style={{ fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#854d0e', padding: '1px 5px', borderRadius: 3 }}>needs refresh</span>}
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary }}>{engRate}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: isActive ? 10 : 0 }}>
              {EDIT_ACTIONS.map(a => {
                const key = `${post.id}_${a.type}`;
                const isRunning = transforming === key;
                return (
                  <button key={a.type} type="button" onClick={() => void handleTransform(post, a.type)} disabled={!!transforming}
                    style={{ padding: '4px 10px', background: isRunning ? a.color : `${a.color}18`, border: `1px solid ${a.color}55`, borderRadius: 5, fontSize: 11, fontWeight: 600, color: isRunning ? '#fff' : a.color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {isRunning ? <><Spinner /></> : a.icon} {a.label}
                  </button>
                );
              })}
            </div>

            {/* Show latest result for this post */}
            {Object.entries(results)
              .filter(([k]) => k.startsWith(post.id + '_'))
              .sort(([a], [b]) => (a > b ? -1 : 1))
              .slice(0, 1)
              .map(([key, r]) => (
                <div key={key} style={{ marginTop: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>
                    {EDIT_ACTIONS.find(a => a.type === r.editType)?.icon} {EDIT_ACTIONS.find(a => a.type === r.editType)?.label} result
                  </div>
                  <div style={{ fontSize: 12, color: '#1e3a5f', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                    {r.after.slice(0, 400)}{r.after.length > 400 ? '…' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => { pushDraftToStudio(r.after); onClose(); }}
                      style={{ padding: '5px 12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      ✏️ Edit in Studio
                    </button>
                    <button type="button" onClick={() => void handleSave(key, r.after, post.id)} disabled={!!saved[key]}
                      style={{ padding: '5px 12px', background: saved[key] ? '#dcfce7' : 'none', color: saved[key] ? '#166534' : colors.textSecondary, border: `1px solid ${saved[key] ? '#86efac' : colors.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {saved[key] ? <><SavedBadge /></> : '💾 Save'}
                    </button>
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(r.after); }}
                      style={{ padding: '5px 10px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: 11, color: colors.textTertiary, cursor: 'pointer' }}>
                      📋
                    </button>
                  </div>
                </div>
              ))}
          </div>
        );
      })}
    </DashboardActionModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// R4 — Stale Content Reviver
// ─────────────────────────────────────────────────────────────────────────────

interface StaleReviverModalProps { open: boolean; onClose: () => void; }

export const StaleReviverModal: React.FC<StaleReviverModalProps> = ({ open, onClose }) => {
  const { posts, loading, error, reload } = usePosts(open, 20);
  const [reviving, setReviving] = useState<string | null>(null);
  const [revived, setRevived] = useState<Record<string, string>>({});
  const [reviveError, setReviveError] = useState('');

  useEffect(() => { if (open) { setRevived({}); setReviveError(''); } }, [open]);

  const gems = useMemo(() =>
    [...posts]
      .filter(p => ageInDays(p.created_at) >= 14)
      .sort((a, b) => engagementScore(b) - engagementScore(a))
      .slice(0, 3),
    [posts]
  );

  const handleRevive = async (post: LinkedInPost) => {
    setReviving(post.id); setReviveError('');
    try {
      // Chain: expand → optimize_engagement
      const expanded = await linkedInWriterApi.editContent({ content: post.text, edit_type: 'expand' });
      const optimised = await linkedInWriterApi.editContent({ content: expanded.content ?? post.text, edit_type: 'optimize_engagement' });
      setRevived(prev => ({ ...prev, [post.id]: optimised.content ?? post.text }));
    } catch { setReviveError('Revival failed. Please try again.'); }
    finally { setReviving(null); }
  };

  return (
    <DashboardActionModal open={open} title="Stale Content Reviver" onClose={onClose} maxWidth={580} maxHeight="min(92vh, 720px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        High-performing posts that haven't been seen in a while. Refresh them with expanded content and stronger hooks.
      </p>

      {loading && <LoadingRow message="Finding your buried gems…" />}
      {error && <ErrorBanner msg={error} />}
      {reviveError && <ErrorBanner msg={reviveError} />}

      {!loading && !error && posts.length > 0 && gems.length === 0 && (
        <EmptyPrompt icon="🌱" title="All posts are fresh" desc="Come back after 14 days to revive your older high-performing content." />
      )}
      {!loading && !error && posts.length === 0 && (
        <EmptyPrompt icon="📭" title="No posts found" desc="Connect LinkedIn to discover revival opportunities." btnLabel="Retry" onLoad={reload} />
      )}

      {!loading && gems.map(post => {
        const days = ageInDays(post.created_at);
        const isReviving = reviving === post.id;
        const revivedText = revived[post.id];
        return (
          <div key={post.id} style={{ ...rowBase, marginBottom: 12, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: colors.textDark, lineHeight: 1.4, marginBottom: 3 }}>
                  {postSnippet(post.text, 90)}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                    {days}d ago
                  </span>
                  <MetricPill icon="❤️" value={post.engagement.reactions ?? 0} label="react." />
                  <MetricPill icon="💬" value={post.engagement.comments ?? 0} label="comments" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>
                    {formatRate(post.engagement.engagement_rate ?? 0)} eng.
                  </span>
                </div>
              </div>
            </div>

            {revivedText ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 6 }}>✨ Revived Version</div>
                <div style={{ fontSize: 12, color: '#14532d', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                  {revivedText.slice(0, 300)}{revivedText.length > 300 ? '…' : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => { pushDraftToStudio(revivedText); onClose(); }}
                    style={{ padding: '5px 12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Edit in Studio
                  </button>
                  <button type="button" onClick={() => { void navigator.clipboard.writeText(revivedText); }}
                    style={{ padding: '5px 10px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: 11, color: colors.textTertiary, cursor: 'pointer' }}>
                    📋 Copy
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void handleRevive(post)} disabled={!!reviving}
                  style={{ padding: '5px 14px', background: isReviving ? '#f59e0b' : '#fef9c3', color: isReviving ? '#fff' : '#854d0e', border: '1.5px solid #f59e0b', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {isReviving ? <><Spinner /> Reviving…</> : '✨ Revive & Refresh'}
                </button>
                <button type="button" onClick={() => { openInCreate('post', post.title ?? 'Post', `New angle on: ${post.text.slice(0, 200)}`); onClose(); }}
                  style={{ padding: '5px 12px', background: 'none', border: `1.5px solid ${colors.primary}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: colors.primary, cursor: 'pointer' }}>
                  💡 New Angle
                </button>
              </div>
            )}
          </div>
        );
      })}
    </DashboardActionModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// R5 — Performance-to-Plan Bridge
// ─────────────────────────────────────────────────────────────────────────────

interface RemixIdea {
  topic: string;
  angle: string;
  sourcePost: string;
}

function buildRemixIdeas(posts: LinkedInPost[]): RemixIdea[] {
  const topPosts = [...posts].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 5);
  return topPosts.map(p => {
    const sentences = p.text.split(/[.!?]/);
    const topic = (p.title ?? sentences[0] ?? '').slice(0, 80).trim();
    const angle = sentences[1]?.trim().slice(0, 100) ?? p.text.slice(0, 100);
    return { topic, angle, sourcePost: p.text.slice(0, 200) };
  });
}

const REMIX_ANGLES = [
  'What I learned from this',
  'The contrarian take',
  'Step-by-step breakdown',
  'Common myths debunked',
  'Behind the scenes story',
];

interface PerfToPlanModalProps { open: boolean; onClose: () => void; }

export const PerfToPlanModal: React.FC<PerfToPlanModalProps> = ({ open, onClose }) => {
  const { posts, loading, error, reload } = usePosts(open, 10);
  const [ideas, setIdeas] = useState<RemixIdea[]>([]);

  useEffect(() => {
    if (!open) return;
    setIdeas([]);
  }, [open]);

  useEffect(() => {
    if (posts.length > 0) {
      setIdeas(buildRemixIdeas(posts));
    }
  }, [posts]);

  const topTopics = useMemo(() => extractTopics(
    [...posts].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 5)
  ), [posts]);

  return (
    <DashboardActionModal open={open} title="Performance-to-Plan Bridge" onClose={onClose} maxWidth={580} maxHeight="min(92vh, 740px)">
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        Your top-performing topics, turned into 5 ready-to-create post ideas. Based on what's already proven to work.
      </p>

      {loading && <LoadingRow message="Analysing your top-performing content…" />}
      {error && <ErrorBanner msg={error} />}
      {!loading && !error && posts.length === 0 && (
        <EmptyPrompt icon="📈" title="No posts found" desc="Connect LinkedIn and publish posts to generate remix ideas." btnLabel="Retry" onLoad={reload} />
      )}

      {!loading && topTopics.length > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            🔍 Your Winning Topics
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {topTopics.map(t => (
              <span key={t} style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && ideas.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            5 Remix Ideas from Your Best Content
          </div>
          {ideas.map((idea, idx) => (
            <div key={idx} style={{ ...rowBase, marginBottom: 10, borderLeft: `3px solid ${idx === 0 ? '#f59e0b' : colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, background: idx === 0 ? '#fef9c3' : '#f1f5f9', color: idx === 0 ? '#854d0e' : colors.textTertiary, padding: '1px 6px', borderRadius: 3 }}>
                    Idea #{idx + 1}
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textDark }}>
                    {idea.topic || `Remix of your post #${idx + 1}`}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: colors.textSecondary, background: colors.badgeBg, padding: '5px 9px', borderRadius: 5, marginBottom: 8, lineHeight: 1.5 }}>
                💡 Angle: "{REMIX_ANGLES[idx % REMIX_ANGLES.length]}"
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { openInCreate('post', idea.topic, `${REMIX_ANGLES[idx % REMIX_ANGLES.length]}. Original context: ${idea.sourcePost}`); onClose(); }}
                  style={{ padding: '5px 12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ✍️ Create This Post
                </button>
                <button type="button" onClick={() => { openInCreate('carousel', idea.topic, idea.sourcePost); onClose(); }}
                  style={{ padding: '5px 12px', background: 'none', border: `1.5px solid #8b5cf6`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#8b5cf6', cursor: 'pointer' }}>
                  🎠 As Carousel
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </DashboardActionModal>
  );
};
