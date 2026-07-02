import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { LinkedInPreferences } from '../utils/storageUtils';
import { linkedInWriterApi } from '../../../services/linkedInWriterApi';
import { getPlatformPersona } from '../../../api/persona';
import { mapTone, mapPostType, mapIndustry, mapSearchEngine } from '../utils/linkedInWriterUtils';

export type QuickCreateContentType = 'post' | 'article' | 'carousel' | 'video_script';

// ── Post Format Picker config ─────────────────────────────────────────────────
interface PostFormat {
  value: string;
  label: string;
  icon: string;
  tip: string;
  accent: string;
}

const POST_FORMATS: PostFormat[] = [
  {
    value: 'thought_leadership',
    label: 'Thought Leadership',
    icon: '🏆',
    tip: 'Bold POV with data & analysis',
    accent: '#6366f1',
  },
  {
    value: 'personal_story',
    label: 'Personal Story',
    icon: '🙋',
    tip: '3–5× more comments than text posts',
    accent: '#ec4899',
  },
  {
    value: 'industry_news',
    label: 'Industry News',
    icon: '📰',
    tip: 'Comment on what\'s happening now',
    accent: '#0ea5e9',
  },
  {
    value: 'professional',
    label: 'Professional',
    icon: '💼',
    tip: 'Clear insight, concise structure',
    accent: '#0a66c2',
  },
  {
    value: 'company_update',
    label: 'Company Update',
    icon: '📢',
    tip: 'Milestones, launches & team wins',
    accent: '#10b981',
  },
  {
    value: 'poll',
    label: 'Poll',
    icon: '📊',
    tip: 'Drives follower spikes quickly',
    accent: '#f59e0b',
  },
];

interface QuickCreateProps {
  onGeneratePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateArticle: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateCarousel: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateVideoScript: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  userPreferences: LinkedInPreferences;
  /** Hide inline grid — modals only (opened via workflow / events) */
  variant?: 'default' | 'hidden';
}

type ContentType = QuickCreateContentType;

const CONTENT_TYPES: { type: ContentType; label: string; icon: string; description: string; color: string }[] = [
  { type: 'post', label: 'Post', icon: '📝', description: 'Professional LinkedIn post with engagement hooks', color: '#0a66c2' },
  { type: 'article', label: 'Article', icon: '📄', description: 'Thought leadership article with in-depth analysis', color: '#057642' },
  { type: 'carousel', label: 'Carousel', icon: '🎠', description: 'Multi-slide carousel for visual storytelling', color: '#8b5cf6' },
  { type: 'video_script', label: 'Video Script', icon: '🎬', description: 'Engaging video script with hook & scenes', color: '#dc2626' }
];

const TONES = ['Professional', 'Conversational', 'Authoritative', 'Inspirational', 'Educational', 'Friendly'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Marketing', 'Consulting', 'Real Estate', 'Legal', 'Non-profit', 'Entertainment', 'Energy', 'Custom'];

// ── PostFormatPicker ──────────────────────────────────────────────────────────
interface PostFormatPickerProps {
  selected: string;
  onSelect: (value: string) => void;
}

const PostFormatPicker: React.FC<PostFormatPickerProps> = ({ selected, onSelect }) => {
  const [hoveredValue, setHoveredValue] = React.useState<string | null>(null);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#374151' }}>
        Post Format
        <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— pick the narrative that fits your goal</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {POST_FORMATS.map(fmt => {
          const isSelected = selected === fmt.value;
          const isHovered = hoveredValue === fmt.value;
          const active = isSelected || isHovered;
          return (
            <button
              key={fmt.value}
              type="button"
              onClick={() => onSelect(fmt.value)}
              onMouseEnter={() => setHoveredValue(fmt.value)}
              onMouseLeave={() => setHoveredValue(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '10px 8px',
                border: `2px solid ${isSelected ? fmt.accent : active ? fmt.accent + '80' : '#e5e7eb'}`,
                borderRadius: 10,
                background: isSelected ? fmt.accent + '12' : active ? fmt.accent + '08' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: isSelected ? `0 2px 10px ${fmt.accent}28` : 'none',
                outline: 'none',
                gap: 3,
              }}
              aria-pressed={isSelected}
              aria-label={`${fmt.label}: ${fmt.tip}`}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{fmt.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? fmt.accent : '#111827', lineHeight: 1.2 }}>
                {fmt.label}
              </span>
              <span style={{ fontSize: 10, color: isSelected ? fmt.accent : '#6b7280', lineHeight: 1.3, fontWeight: 500 }}>
                {fmt.tip}
              </span>
              {isSelected && (
                <span style={{ marginTop: 2, fontSize: 9, fontWeight: 800, letterSpacing: '0.4px', color: fmt.accent, textTransform: 'uppercase' }}>
                  ✓ Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── LengthPresetPicker ────────────────────────────────────────────────────────
interface LengthPreset {
  label: string;
  value: number;
  tip: string;
}

interface LengthPresetPickerProps {
  label: string;
  presets: LengthPreset[];
  selected: number;
  onSelect: (value: number) => void;
}

const LengthPresetPicker: React.FC<LengthPresetPickerProps> = ({ label, presets, selected, onSelect }) => {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#374151' }}>
        {label}
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${presets.length}, 1fr)`, gap: 6 }}>
        {presets.map(preset => {
          const isSelected = selected === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onSelect(preset.value)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '9px 6px',
                border: `2px solid ${isSelected ? '#0a66c2' : '#e5e7eb'}`,
                borderRadius: 8,
                background: isSelected ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                outline: 'none',
                gap: 2,
              }}
              aria-pressed={isSelected}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#0a66c2' : '#111827', lineHeight: 1.2 }}>
                {preset.label}
              </span>
              <span style={{ fontSize: 10, color: isSelected ? '#2563eb' : '#6b7280', lineHeight: 1.3, fontWeight: 500, textAlign: 'center' }}>
                {preset.tip}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ARTICLE_LENGTH_PRESETS: LengthPreset[] = [
  { label: 'Concise', value: 800, tip: '800w · Quick read' },
  { label: 'Standard', value: 1500, tip: '1500w · Best ranking' },
  { label: 'Comprehensive', value: 3000, tip: '3000w · Deep authority' },
];

const CAROUSEL_SLIDE_PRESETS: LengthPreset[] = [
  { label: 'Quick', value: 5, tip: '5 slides · Story format' },
  { label: 'Standard', value: 8, tip: '8 slides · Best engagement' },
  { label: 'Deep Dive', value: 12, tip: '12 slides · Edu content' },
];

const VIDEO_LENGTH_PRESETS: LengthPreset[] = [
  { label: 'Reel', value: 30, tip: '30s · Max reach' },
  { label: 'Short', value: 60, tip: '60s · Sweet spot' },
  { label: 'Long Form', value: 180, tip: '3 min · Storytelling' },
];

// ── Persona Badge (Feature 3) ─────────────────────────────────────────────────
interface PersonaInfo {
  name: string;
  archetype: string;
}

const PersonaBadge: React.FC<{ persona: PersonaInfo; toneLabel: string }> = ({ persona, toneLabel }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 12px',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
      border: '1px solid #bae6fd',
      borderRadius: 8,
      marginBottom: 14,
    }}
  >
    <span style={{ fontSize: 16, lineHeight: 1 }}>🎭</span>
    <div style={{ flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#0369a1' }}>Writing as </span>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#0c4a6e' }}>{persona.name}</span>
      <span style={{ fontSize: 11, color: '#0369a1', marginLeft: 4 }}>· {persona.archetype}</span>
    </div>
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#6366f1',
        background: '#eef2ff',
        border: '1px solid #c7d2fe',
        borderRadius: 5,
        padding: '2px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {toneLabel} tone
    </span>
  </div>
);

// ── Variation Result types + helpers (Feature 5) ──────────────────────────────
interface VariationResult {
  label: string;
  toneIcon: string;
  content: string | null;
  error: string | null;
}

function assembleFullContent(data: any): string {
  const content = data?.content || '';
  const hashtags = (data?.hashtags || []).map((h: any) =>
    typeof h === 'string' ? h : h?.hashtag || ''
  ).filter(Boolean).join(' ');
  const cta = data?.call_to_action || '';
  let full = content;
  if (hashtags) full += `\n\n${hashtags}`;
  if (cta) full += `\n\n${cta}`;
  return full;
}

const VARIATION_TONES = [
  { tone: '', label: 'Your Tone', toneIcon: '🎯' },
  { tone: 'conversational', label: 'Conversational', toneIcon: '💬' },
  { tone: 'inspirational', label: 'Inspirational', toneIcon: '🚀' },
];

const VariationPicker: React.FC<{
  variations: VariationResult[];
  generating: boolean;
  onUse: (content: string) => void;
}> = ({ variations, generating, onUse }) => {
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null);
  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {generating ? (
          <>
            <div
              style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid #0a66c2', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Generating 3 tone variations — this may take a moment…
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
            Pick the best variation and send it to the editor
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(generating ? VARIATION_TONES : variations).map((v, i) => {
          const result = variations[i];
          const isLoading = generating;
          const hasContent = !isLoading && result?.content;
          const hasError = !isLoading && result?.error;
          const expanded = expandedIdx === i;
          return (
            <div
              key={i}
              style={{
                border: `1.5px solid ${hasContent ? '#bfdbfe' : '#e5e7eb'}`,
                borderRadius: 10,
                background: hasContent ? '#f8faff' : '#f9fafb',
                overflow: 'hidden',
                transition: 'border-color 180ms',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  cursor: hasContent ? 'pointer' : 'default',
                }}
                onClick={() => hasContent && setExpandedIdx(expanded ? null : i)}
              >
                <span style={{ fontSize: 16 }}>{v.toneIcon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', flex: 1 }}>
                  {v.label}
                </span>
                {isLoading && (
                  <div
                    style={{
                      width: 12, height: 12, borderRadius: '50%',
                      border: '2px solid #9ca3af', borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                )}
                {hasError && (
                  <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>Failed</span>
                )}
                {hasContent && (
                  <>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {expanded ? 'hide ▲' : 'preview ▼'}
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onUse(result.content!); }}
                      style={{
                        padding: '5px 12px',
                        border: 'none',
                        borderRadius: 6,
                        background: '#0a66c2',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Use this ✓
                    </button>
                  </>
                )}
              </div>
              {expanded && hasContent && (
                <div
                  style={{
                    padding: '0 12px 12px',
                    borderTop: '1px solid #e0e7ef',
                    maxHeight: 180,
                    overflowY: 'auto',
                    fontSize: 12,
                    color: '#334155',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {result.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const defaultForm = {
  topic: '',
  industry: '',
  tone: '',
  target_audience: '',
  key_points: '',
  post_type: 'thought_leadership',
  word_count: 1500,
  number_of_slides: 8,
  video_length: 60,
  key_takeaways: '',
  key_messages: '',
  key_sections: ''
};

export const QuickCreate: React.FC<QuickCreateProps> = ({
  onGeneratePost,
  onGenerateArticle,
  onGenerateCarousel,
  onGenerateVideoScript,
  userPreferences,
  variant = 'default',
}) => {
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [generating, setGenerating] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Feature 3 — Persona badge
  const [personaInfo, setPersonaInfo] = useState<PersonaInfo | null>(null);

  // Feature 5 — 3-Variation generate
  const [variationsMode, setVariationsMode] = useState(false);
  const [variationsPhase, setVariationsPhase] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [variations, setVariations] = useState<VariationResult[]>([]);
  const variationAbortRef = useRef<AbortController | null>(null);

  const openModal = useCallback((type: ContentType) => {
    setFormData({
      ...defaultForm,
      industry: userPreferences?.industry || '',
      tone: userPreferences?.tone || 'Professional',
      target_audience: userPreferences?.target_audience || '',
    });
    setSelectedType(type);
    setVariationsMode(false);
    setVariationsPhase('idle');
    setVariations([]);
  }, [userPreferences]);

  const closeModal = useCallback(() => {
    variationAbortRef.current?.abort();
    setSelectedType(null);
    setFormData(defaultForm);
    setTopicError(null);
    setVariationsMode(false);
    setVariationsPhase('idle');
    setVariations([]);
  }, []);

  useEffect(() => {
    const onOpenQuickCreate = (event: Event) => {
      const detail = (event as CustomEvent<{
        type?: string;
        topic?: string;
        key_points?: string;
        target_audience?: string;
        industry?: string;
        post_type?: string;
      }>).detail;
      const type = detail?.type;
      if (
        type === 'post' ||
        type === 'article' ||
        type === 'carousel' ||
        type === 'video_script'
      ) {
        // Open modal with defaults first, then overlay any pre-fill data from the event
        setFormData({
          ...defaultForm,
          industry: detail?.industry || userPreferences?.industry || '',
          tone: userPreferences?.tone || 'Professional',
          target_audience: detail?.target_audience || userPreferences?.target_audience || '',
          ...(detail?.topic ? { topic: detail.topic } : {}),
          ...(detail?.key_points ? { key_points: detail.key_points } : {}),
          ...(detail?.post_type ? { post_type: detail.post_type } : {}),
        });
        setSelectedType(type);
        setTopicError(null);
        setVariationsMode(false);
        setVariationsPhase('idle');
        setVariations([]);
      }
    };
    window.addEventListener('linkedinwriter:openQuickCreate', onOpenQuickCreate);
    return () => window.removeEventListener('linkedinwriter:openQuickCreate', onOpenQuickCreate);
  }, [userPreferences]);

  useEffect(() => {
    if (!selectedType) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedType, closeModal]);

  // Feature 3 — fetch LinkedIn persona when post modal opens
  useEffect(() => {
    if (selectedType !== 'post') {
      setPersonaInfo(null);
      return;
    }
    let cancelled = false;
    getPlatformPersona('linkedin')
      .then((data: any) => {
        if (cancelled) return;
        const name =
          data?.core_persona?.persona_name ||
          data?.persona_name ||
          data?.writing_persona?.persona_name;
        const archetype =
          data?.core_persona?.archetype ||
          data?.archetype ||
          data?.writing_persona?.archetype;
        if (name && archetype) setPersonaInfo({ name, archetype });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedType]);

  const handleGenerate = async () => {
    if (!selectedType || generating) return;
    if (!formData.topic.trim()) {
      setTopicError('Please enter a topic to continue.');
      return;
    }
    setTopicError(null);

    // Feature 5 — variations path (posts only)
    if (variationsMode && selectedType === 'post') {
      setGenerating(true);
      setVariationsPhase('generating');

      const baseRequest = {
        topic: formData.topic.trim(),
        industry: mapIndustry(formData.industry || 'Technology') as any,
        post_type: mapPostType(formData.post_type) as any,
        target_audience: formData.target_audience || 'Business leaders and professionals',
        key_points: formData.key_points ? [formData.key_points] : [],
        include_hashtags: true,
        include_call_to_action: true,
        research_enabled: true,
        max_length: 2000,
        grounding_level: 'enhanced' as any,
        include_citations: true,
      };

      const toneVariants = [
        { tone: mapTone(formData.tone || 'professional') as any, label: formData.tone || 'Your Tone', toneIcon: '🎯' },
        { tone: 'conversational' as any, label: 'Conversational', toneIcon: '💬' },
        { tone: 'inspirational' as any, label: 'Inspirational', toneIcon: '🚀' },
      ];

      const results = await Promise.allSettled(
        toneVariants.map(v =>
          linkedInWriterApi.generatePost({ ...baseRequest, tone: v.tone })
        )
      );

      const resolved: VariationResult[] = results.map((r, i) => ({
        label: toneVariants[i].label,
        toneIcon: toneVariants[i].toneIcon,
        content:
          r.status === 'fulfilled' && r.value.success && r.value.data
            ? assembleFullContent(r.value.data)
            : null,
        error:
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && !r.value.success)
            ? 'Generation failed'
            : null,
      }));

      setVariations(resolved);
      setVariationsPhase('ready');
      setGenerating(false);
      return;
    }

    // Normal single-generation path
    setGenerating(true);
    const params = { ...formData };
    try {
      const generators = {
        post: onGeneratePost,
        article: onGenerateArticle,
        carousel: onGenerateCarousel,
        video_script: onGenerateVideoScript
      };
      await generators[selectedType](params);
      closeModal();
    } finally {
      setGenerating(false);
    }
  };

  const handleUseVariation = useCallback((content: string) => {
    window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: content }));
    closeModal();
  }, [closeModal]);

  const setField = useCallback((field: string, value: any) => {
    if (field === 'topic') setTopicError(null);
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const modalContent = useMemo(() => {
    if (!selectedType) return null;

    const commonFields = (
      <>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Topic *</label>
          <input
            value={formData.topic}
            onChange={e => setField('topic', e.target.value)}
            placeholder={`e.g., ${selectedType === 'video_script' ? 'Networking tips' : 'AI trends in ' + (formData.industry || 'Technology')}`}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${topicError ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
          {topicError && (
            <p style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 12 }}>{topicError}</p>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Industry</label>
            <select
              value={formData.industry}
              onChange={e => setField('industry', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white' }}
            >
              {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Tone</label>
            <select
              value={formData.tone}
              onChange={e => setField('tone', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white' }}
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Target Audience</label>
          <input
            value={formData.target_audience}
            onChange={e => setField('target_audience', e.target.value)}
            placeholder="e.g., Product Managers, CTOs"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </>
    );

    switch (selectedType) {
      case 'post':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Post</h3>
            {personaInfo && (
              <PersonaBadge
                persona={personaInfo}
                toneLabel={formData.tone || 'Professional'}
              />
            )}
            <PostFormatPicker
              selected={formData.post_type}
              onSelect={value => setField('post_type', value)}
            />
            {commonFields}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Points</label>
              <textarea
                value={formData.key_points}
                onChange={e => setField('key_points', e.target.value)}
                placeholder="Key point 1 / Key point 2 / Key point 3"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
      case 'article':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Article</h3>
            {commonFields}
            <LengthPresetPicker
              label="Article Length"
              presets={ARTICLE_LENGTH_PRESETS}
              selected={formData.word_count}
              onSelect={value => setField('word_count', value)}
            />
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Sections</label>
              <textarea
                value={formData.key_sections}
                onChange={e => setField('key_sections', e.target.value)}
                placeholder="Introduction / Current challenges / Best practices / Future outlook"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
      case 'carousel':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Carousel</h3>
            {commonFields}
            <LengthPresetPicker
              label="Number of Slides"
              presets={CAROUSEL_SLIDE_PRESETS}
              selected={formData.number_of_slides}
              onSelect={value => setField('number_of_slides', value)}
            />
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Takeaways</label>
              <textarea
                value={formData.key_takeaways}
                onChange={e => setField('key_takeaways', e.target.value)}
                placeholder="Key insight / Important trend / Actionable tip"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
      case 'video_script':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Video Script</h3>
            {commonFields}
            <LengthPresetPicker
              label="Video Length"
              presets={VIDEO_LENGTH_PRESETS}
              selected={formData.video_length}
              onSelect={value => setField('video_length', value)}
            />
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Messages</label>
              <textarea
                value={formData.key_messages}
                onChange={e => setField('key_messages', e.target.value)}
                placeholder="Core message / Practical advice / Call to action"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
    }
  }, [selectedType, formData, topicError, personaInfo]);

  const showInlineGrid = variant === 'default';

  return (
    <div style={{ width: '100%', marginTop: showInlineGrid ? 8 : 0 }}>
      {showInlineGrid && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, textAlign: 'center' }}>Quick Create</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {CONTENT_TYPES.map(({ type, label, icon, description, color }) => (
              <button
                key={type}
                onClick={() => openModal(type)}
                style={{
                  padding: '14px 10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: '1.3' }}>{description}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Generation Modal */}
      {selectedType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: 20 }}>
          <div style={{ background: 'white', width: variationsPhase !== 'idle' ? 620 : 520, maxWidth: '100%', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', transition: 'width 200ms ease' }}>

            {/* Modal header */}
            <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>
                {CONTENT_TYPES.find(c => c.type === selectedType)?.icon}{' '}
                {variationsPhase !== 'idle'
                  ? '3 Tone Variations'
                  : CONTENT_TYPES.find(c => c.type === selectedType)?.label}
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>

            {/* Modal body — swaps to VariationPicker when in variations phase */}
            <div style={{ padding: 16, maxHeight: '66vh', overflow: 'auto' }}>
              {variationsPhase !== 'idle'
                ? (
                  <VariationPicker
                    variations={variations}
                    generating={variationsPhase === 'generating'}
                    onUse={handleUseVariation}
                  />
                )
                : modalContent}
            </div>

            {/* Modal footer */}
            {variationsPhase === 'idle' && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Feature 5 — variations toggle (posts only) */}
                {selectedType === 'post' && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flex: 1,
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      color: variationsMode ? '#6366f1' : '#6b7280',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={variationsMode}
                      onChange={e => setVariationsMode(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: '#6366f1', cursor: 'pointer' }}
                    />
                    Generate 3 tone variations
                    {variationsMode && (
                      <span style={{ fontSize: 10, background: '#eef2ff', color: '#6366f1', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                        HITL
                      </span>
                    )}
                  </label>
                )}
                {selectedType !== 'post' && <div style={{ flex: 1 }} />}

                <button onClick={closeModal} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: 8,
                    background: generating ? '#9ca3af' : variationsMode ? '#6366f1' : (CONTENT_TYPES.find(c => c.type === selectedType)?.color || '#0a66c2'),
                    color: 'white',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: generating ? 0.7 : 1,
                  }}
                >
                  {generating && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                  {generating ? 'Generating...' : variationsMode ? '✦ Generate 3 Variations' : 'Generate'}
                </button>
              </div>
            )}

            {/* Variations footer — only shown while results are ready */}
            {variationsPhase === 'ready' && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeModal}
                  style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
                >
                  Close without selecting
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
