import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LinkedInPreferences, getToneDropdownValue, isCustomToneSelection, resolvePersonaTone } from '../utils/storageUtils';
import { linkedInWriterApi } from '../../../services/linkedInWriterApi';
import { getPlatformPersona } from '../../../api/persona';
import { mapTone, mapPostType, mapIndustry, mapSearchEngine } from '../utils/linkedInWriterUtils';
import { apiClient } from '../../../api/client';
import DataSourceSelector from './Brainstorm/DataSourceSelector';
import MySavedIdeas from './Brainstorm/MySavedIdeas';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { KeyPointsSection } from './KeyPointsSection';
import { VariationPicker, assembleFullContent, type VariationResult } from './VariationPicker';
import { StudioModalCloseButton } from './dashboard/StudioModalCloseButton';
import { DEFAULT_LINKEDIN_POST_MAX_LENGTH } from '../utils/linkedInPostAssembly';
import { CustomToneSelect } from './CustomToneSelect';
import {
  isCreateWedgeContentTypeLocked,
  type CreateWedgeLockedContentType,
} from '../utils/linkedInConnectLockedUi';
import { CreateWedgeComingSoonTile } from './dashboard/CreateWedgeComingSoonTile';
import { useCreateWedgeNotify } from '../hooks/useCreateWedgeNotify';
import { dispatchLinkedInDraftUpdate } from '../utils/linkedInDraftContentTypeStorage';
import { PostTodayModal } from './dashboard/analysisWedgeModalExports';
import {
  openWorkflowWedge,
  type QuickCreateReturnTarget,
} from './dashboard/engagementWedgeNavigation';
import type { PostPulseCreateMode } from './dashboard/postPulseCreateUtils';
import { ReferencePostContextBanner } from './dashboard/ReferencePostContextBanner';
import { DashboardModalBackButton } from './dashboard/DashboardModalBackButton';


export type QuickCreateContentType = 'post' | 'article' | 'carousel' | 'video_script';

// ── Post Format Picker config ─────────────────────────────────────────────────
interface PostFormat {
  value: string;
  label: string;
  shortLabel: string;
  icon: string;
  tip: string;
  accent: string;
}

const POST_FORMATS: PostFormat[] = [
  {
    value: 'thought_leadership',
    label: 'Thought Leadership',
    shortLabel: 'Thought Leadership',
    icon: '🏆',
    tip: 'Bold POV with data & analysis',
    accent: '#6366f1',
  },
  {
    value: 'personal_story',
    label: 'Personal Story',
    shortLabel: 'Personal',
    icon: '🙋',
    tip: '3–5× more comments than text posts',
    accent: '#ec4899',
  },
  {
    value: 'industry_news',
    label: 'Industry News',
    shortLabel: 'Industry',
    icon: '📰',
    tip: 'Comment on what\'s happening now',
    accent: '#0ea5e9',
  },
  {
    value: 'professional',
    label: 'Professional',
    shortLabel: 'Professional',
    icon: '💼',
    tip: 'Clear insight, concise structure',
    accent: '#0a66c2',
  },
  {
    value: 'company_update',
    label: 'Company Update',
    shortLabel: 'Company Update',
    icon: '📢',
    tip: 'Milestones, launches & team wins',
    accent: '#10b981',
  },
  {
    value: 'poll',
    label: 'Poll',
    shortLabel: 'Poll',
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
  onGenerateOutline: (params?: any) => Promise<{ success: boolean; outline?: any; error?: string }>;
  userPreferences: LinkedInPreferences;
  outlineMode: boolean;
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
    <div className="linkedin-post-format-picker" style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#374151' }}>
        Post Format
        <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— pick the narrative that fits your goal</span>
      </label>
      <div className="linkedin-post-format-picker__grid">
        {POST_FORMATS.map(fmt => {
          const isSelected = selected === fmt.value;
          const isHovered = hoveredValue === fmt.value;
          const active = isSelected || isHovered;
          return (
            <button
              key={fmt.value}
              type="button"
              className="linkedin-post-format-picker__option"
              onClick={() => onSelect(fmt.value)}
              onMouseEnter={() => setHoveredValue(fmt.value)}
              onMouseLeave={() => setHoveredValue(null)}
              style={{
                border: `2px solid ${isSelected ? fmt.accent : active ? fmt.accent + '80' : '#e5e7eb'}`,
                background: isSelected ? fmt.accent + '12' : active ? fmt.accent + '08' : '#ffffff',
                boxShadow: isSelected ? `0 2px 10px ${fmt.accent}28` : 'none',
              }}
              aria-pressed={isSelected}
              aria-label={`${fmt.label}: ${fmt.tip}`}
              title={fmt.tip}
            >
              <span className="linkedin-post-format-picker__icon" aria-hidden>{fmt.icon}</span>
              <span
                className="linkedin-post-format-picker__label"
                style={{ color: isSelected ? fmt.accent : '#111827' }}
              >
                {fmt.shortLabel}
              </span>
              <span
                className="linkedin-post-format-picker__tip"
                style={{ color: isSelected ? fmt.accent : '#6b7280' }}
              >
                {fmt.tip}
              </span>
              {isSelected && (
                <span
                  className="linkedin-post-format-picker__selected"
                  style={{ color: fmt.accent }}
                >
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

// ── Variation helpers imported from VariationPicker ──────────────────────────

const defaultForm = {
  topic: '',
  industry: '',
  tone: '',
  custom_tone: '',
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
  onGenerateOutline,
  userPreferences,
  outlineMode,
  variant = 'default',
}) => {
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [generating, setGenerating] = useState(false);
  const [brainstorming, setBrainstorming] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [outlinePlanMode, setOutlinePlanMode] = useState(false);

  // Feature 3 — Persona badge
  const [personaInfo, setPersonaInfo] = useState<PersonaInfo | null>(null);

  // Feature 5 — 3-Variation generate
  const [variationsMode, setVariationsMode] = useState(false);
  const [variationsPhase, setVariationsPhase] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [variations, setVariations] = useState<VariationResult[]>([]);
  const variationAbortRef = useRef<AbortController | null>(null);
  const brainstormTimeoutRef = useRef<number | null>(null);
  const brainstromActiveRef = useRef(false);
  const brainstormingRef = useRef(false);

  const [myIdeasOpen, setMyIdeasOpen] = useState(false);
  const [postTodayOpen, setPostTodayOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [returnTo, setReturnTo] = useState<QuickCreateReturnTarget | null>(null);
  const [referenceContext, setReferenceContext] = useState<string | null>(null);
  const [referenceMode, setReferenceMode] = useState<PostPulseCreateMode | null>(null);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [usePersona, setUsePersona] = useState(false);
  const [includeTrending, setIncludeTrending] = useState(false);
  const [remarketContent, setRemarketContent] = useState(false);
  const { connected } = useLinkedInSocialConnection();
  const { notifyRequested, handleNotify } = useCreateWedgeNotify();

  const refreshSavedCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/brainstorm/saved-ideas', {
        params: { limit: 100, offset: 0 },
      });
      setSavedCount(Number(res.data?.total) || 0);
    } catch (err) {
      console.debug('[QuickCreate] saved ideas count refresh failed', err);
    }
  }, []);

  useEffect(() => {
    if (selectedType) void refreshSavedCount();
  }, [selectedType, refreshSavedCount]);

  const openModal = useCallback((type: ContentType) => {
    if (isCreateWedgeContentTypeLocked(type)) return;
    if (brainstormTimeoutRef.current) {
      window.clearTimeout(brainstormTimeoutRef.current);
      brainstormTimeoutRef.current = null;
    }
    brainstromActiveRef.current = false;
    setGenerating(false);
    setFormData({
      ...defaultForm,
      industry: userPreferences?.industry || '',
      tone: getToneDropdownValue(userPreferences),
      custom_tone: userPreferences?.custom_tone || '',
      target_audience: userPreferences?.target_audience || '',
    });
    setSelectedType(type);
    setVariationsMode(false);
    setVariationsPhase('idle');
    setVariations([]);
    setGenerationError(null);
    setAdvancedOpen(false);
    setUsePersona(false);
    setIncludeTrending(false);
    setRemarketContent(false);
    setReferenceContext(null);
    setReferenceMode(null);
  }, [userPreferences]);

  const closeModal = useCallback(() => {
    if (brainstormTimeoutRef.current) {
      window.clearTimeout(brainstormTimeoutRef.current);
      brainstormTimeoutRef.current = null;
    }
    brainstromActiveRef.current = false;
    variationAbortRef.current?.abort();
    setSelectedType(null);
    setFormData(defaultForm);
    setTopicError(null);
    setGenerationError(null);
    setVariationsMode(false);
    setVariationsPhase('idle');
    setVariations([]);
    setAdvancedOpen(false);
    setUsePersona(false);
    setIncludeTrending(false);
    setRemarketContent(false);
    setReturnTo(null);
    setReferenceContext(null);
    setReferenceMode(null);
  }, []);

  const handleBackNavigation = useCallback(() => {
    const target = returnTo;
    closeModal();
    if (target) {
      openWorkflowWedge({
        wedge: target.wedge,
        sub: target.sub,
      });
    }
  }, [returnTo, closeModal]);

  useEffect(() => {
    const onOpenQuickCreate = (event: Event) => {
      const detail = (event as CustomEvent<{
        type?: string;
        topic?: string;
        key_points?: string;
        target_audience?: string;
        industry?: string;
        post_type?: string;
        returnTo?: QuickCreateReturnTarget;
        reference_context?: string;
        reference_mode?: PostPulseCreateMode;
      }>).detail;
      const type = detail?.type;
      if (
        type === 'post' ||
        type === 'article' ||
        type === 'carousel' ||
        type === 'video_script'
      ) {
        // Clear brainstorm safety timeout — idea was selected
        if (brainstormTimeoutRef.current) {
          window.clearTimeout(brainstormTimeoutRef.current);
          brainstormTimeoutRef.current = null;
        }
        brainstromActiveRef.current = false;
        setGenerating(false);

        // Open modal with defaults first, then overlay any pre-fill data from the event
        setFormData({
          ...defaultForm,
          industry: detail?.industry || userPreferences?.industry || '',
          tone: getToneDropdownValue(userPreferences),
          custom_tone: userPreferences?.custom_tone || '',
          target_audience: detail?.target_audience || userPreferences?.target_audience || '',
          ...(detail?.topic ? { topic: detail.topic } : {}),
          ...(detail?.key_points ? { key_points: detail.key_points } : {}),
          ...(detail?.post_type ? { post_type: detail.post_type } : {}),
        });
        setSelectedType(type);
        setTopicError(null);
        setGenerationError(null);
        setVariationsMode(false);
        setVariationsPhase('idle');
        setVariations([]);
        setAdvancedOpen(false);
        setUsePersona(false);
        setIncludeTrending(false);
        setRemarketContent(false);
        setReturnTo(detail?.returnTo ?? null);
        setReferenceContext(detail?.reference_context?.trim() || null);
        setReferenceMode(detail?.reference_mode ?? null);
      }
    };
    window.addEventListener('linkedinwriter:openQuickCreate', onOpenQuickCreate);
    return () => window.removeEventListener('linkedinwriter:openQuickCreate', onOpenQuickCreate);
  }, [userPreferences]);

  // Apply topic from nested Brainstorm / Post Today without closing Post modal
  useEffect(() => {
    const onApplyTopic = (event: Event) => {
      const detail = (event as CustomEvent<{
        topic?: string;
        key_points?: string;
        industry?: string;
        tone?: string;
        target_audience?: string;
      }>).detail;
      if (!detail) return;
      console.debug('[QuickCreate] applying topic from nested modal', detail);
      setFormData((prev) => ({
        ...prev,
        ...(detail.topic != null ? { topic: detail.topic } : {}),
        ...(detail.key_points != null ? { key_points: detail.key_points } : {}),
        ...(detail.industry != null ? { industry: detail.industry } : {}),
        ...(detail.tone != null ? { tone: detail.tone } : {}),
        ...(detail.target_audience != null
          ? { target_audience: detail.target_audience }
          : {}),
      }));
      setTopicError(null);
    };
    window.addEventListener('linkedinwriter:quickCreateApplyTopic', onApplyTopic);
    return () =>
      window.removeEventListener('linkedinwriter:quickCreateApplyTopic', onApplyTopic);
  }, []);

  // Cancel brainstorm safety timeout when BrainstormFlow starts (it's actively processing)
  useEffect(() => {
    const onBrainstormStarted = () => {
      brainstormingRef.current = false;
      setBrainstorming(false);
      if (brainstormTimeoutRef.current) {
        window.clearTimeout(brainstormTimeoutRef.current);
        brainstormTimeoutRef.current = null;
      }
    };
    // Cancel brainstorm safety timeout when BrainstormFlow is manually closed
    const onCancelBrainstorm = () => {
      brainstormingRef.current = false;
      setBrainstorming(false);
      if (brainstormTimeoutRef.current) {
        window.clearTimeout(brainstormTimeoutRef.current);
        brainstormTimeoutRef.current = null;
      }
      brainstromActiveRef.current = false;
    };
    window.addEventListener('linkedinwriter:brainstormStarted', onBrainstormStarted);
    window.addEventListener('linkedinwriter:cancelBrainstorm', onCancelBrainstorm);
    return () => {
      window.removeEventListener('linkedinwriter:brainstormStarted', onBrainstormStarted);
      window.removeEventListener('linkedinwriter:cancelBrainstorm', onCancelBrainstorm);
    };
  }, []);

  useEffect(() => {
    if (!selectedType) return;
    document.body.classList.add('linkedin-quick-create-open');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('linkedin-quick-create-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedType, closeModal]);

  // Feature 3 — fetch LinkedIn persona when post modal opens (skip for non-connected users)
  useEffect(() => {
    if (selectedType !== 'post') {
      setPersonaInfo(null);
      return;
    }
    if (!connected) return;
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
  }, [selectedType, connected]);

  const handleGenerate = async () => {
    if (!selectedType || generating) return;
    if (!formData.topic.trim()) {
      setTopicError('Please enter a topic to continue.');
      return;
    }
    if (isCustomToneSelection(formData.tone) && !formData.custom_tone?.trim()) {
      setGenerationError('Please enter a custom tone or select a preset tone.');
      return;
    }
    setTopicError(null);
    setGenerationError(null);

    const resolvedToneLabel = resolvePersonaTone({
      tone: formData.tone,
      custom_tone: formData.custom_tone,
    });

    // Feature 5 — variations path (posts only)
    if (variationsMode && selectedType === 'post') {
      setGenerating(true);
      setVariationsPhase('generating');

      const baseRequest = {
        topic: formData.topic.trim(),
        industry: mapIndustry(formData.industry || 'Technology') as any,
        post_type: mapPostType(formData.post_type) as any,
        target_audience: formData.target_audience || 'Business leaders and professionals',
        key_points: formData.key_points
          ? formData.key_points.split(' / ').map(kp => kp.trim()).filter(Boolean)
          : [],
        ...(referenceContext ? { reference_context: referenceContext } : {}),
        include_hashtags: true,
        include_call_to_action: true,
        research_enabled: true,
        max_length: DEFAULT_LINKEDIN_POST_MAX_LENGTH,
        grounding_level: 'enhanced' as any,
        include_citations: true,
      };

      const toneVariants = [
        { tone: mapTone(formData.tone, formData.custom_tone) as any, label: resolvedToneLabel, toneIcon: '🎯' },
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

    // Outline-plan path (article only)
    if (outlinePlanMode && selectedType === 'article') {
      setGenerating(true);
      const params = { ...formData };
      try {
        await onGenerateOutline(params);
        closeModal();
      } finally {
        setGenerating(false);
      }
      return;
    }

    // Normal single-generation path
    setGenerationError(null);
    setGenerating(true);
    const params = {
      ...formData,
      key_points: formData.key_points
        ? formData.key_points.split(' / ').map(kp => kp.trim()).filter(Boolean)
        : [],
      ...(referenceContext ? { reference_context: referenceContext } : {}),
    };
    try {
      const generators = {
        post: onGeneratePost,
        article: onGenerateArticle,
        carousel: onGenerateCarousel,
        video_script: onGenerateVideoScript
      };
      const result = await generators[selectedType](params);
      if (result.success) {
        closeModal();
      } else {
        setGenerationError(result.error || 'Generation failed. Please try again.');
      }
    } catch (e: any) {
      setGenerationError(e?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUseVariation = useCallback((content: string) => {
    if (selectedType) {
      dispatchLinkedInDraftUpdate(content, selectedType);
    } else {
      dispatchLinkedInDraftUpdate(content);
    }
    closeModal();
  }, [closeModal, selectedType]);

  const setField = useCallback((field: string, value: any) => {
    if (field === 'topic') setTopicError(null);
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const modalContent = useMemo(() => {
    if (!selectedType) return null;

    const commonFields = (
      <>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>
            Topic
          </label>
          {selectedType === 'post' || selectedType === 'article' ? (
            <div
              className={`linkedin-quick-create-field-card${topicError ? ' linkedin-quick-create-field-card--error' : ''}`}
            >
              <input
                value={formData.topic}
                onChange={e => setField('topic', e.target.value)}
                placeholder={`e.g., AI trends in ${formData.industry || 'Technology'}`}
                className="linkedin-quick-create-field-card__input"
              />
              {(selectedType === 'post' || selectedType === 'article') && (
                <div className="linkedin-quick-create-field-card__actions">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={brainstorming}
                    onClick={() => {
                      if (brainstormingRef.current) return;
                      const topic = formData.topic.trim();
                      const brainstormType = selectedType;
                      if (!topic) {
                        setTopicError('Enter a topic first to brainstorm ideas.');
                        return;
                      }

                      brainstormingRef.current = true;
                      setBrainstorming(true);
                      brainstromActiveRef.current = true;
                      setTopicError(null);

                      variationAbortRef.current?.abort();

                      brainstormTimeoutRef.current = window.setTimeout(() => {
                        if (brainstromActiveRef.current) {
                          brainstromActiveRef.current = false;
                          brainstormingRef.current = false;
                          setBrainstorming(false);
                          console.warn(
                            '[QuickCreate] brainstorm safety timeout — BrainstormFlow did not start',
                          );
                        }
                      }, 15000);

                      window.dispatchEvent(new CustomEvent('linkedinwriter:runBrainstormIdeas', {
                        detail: {
                          seed: topic,
                          type: brainstormType,
                          options: { usePersona, includeTrending, remarketContent },
                          forceRefresh: false,
                          industry: formData.industry,
                          tone: formData.tone,
                          target_audience: formData.target_audience,
                          stackOverQuickCreate: true,
                        },
                      }));
                    }}
                    className={`linkedin-quick-create-field-card__btn linkedin-quick-create-field-card__btn--brainstorm${brainstorming ? ' linkedin-quick-create-field-card__btn--disabled' : ''}`}
                  >
                    {brainstorming ? '⏳ Generating...' : '🧠 Brainstorm'}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setMyIdeasOpen(true)}
                    className="linkedin-quick-create-field-card__btn linkedin-quick-create-field-card__btn--saved"
                  >
                    📚 Browse Saved Ideas{savedCount > 0 ? ` (${savedCount})` : ''}
                  </button>
                  {selectedType === 'post' && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setPostTodayOpen(true)}
                      className="linkedin-quick-create-field-card__btn linkedin-quick-create-field-card__btn--post-today"
                    >
                      🎯 Post Today
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <input
              value={formData.topic}
              onChange={e => setField('topic', e.target.value)}
              placeholder={`e.g., ${selectedType === 'video_script' ? 'Networking tips' : 'AI trends in ' + (formData.industry || 'Technology')}`}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${topicError ? '#ef4444' : '#d1d5db'}`,
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
          {topicError && (
            <p style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 12 }}>{topicError}</p>
          )}
        </div>

        {/* Saved Ideas — carousel / video (post & article use inline topic actions) */}
        {selectedType !== 'post' && selectedType !== 'article' && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setMyIdeasOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              border: '1px solid #e0e7ff',
              borderRadius: 8,
              background: '#eef2ff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#4338ca',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e0e7ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#eef2ff'; }}
          >
            📚 Browse Saved Ideas{savedCount > 0 ? ` (${savedCount})` : ''}
          </button>
        </div>
        )}

        {/* DataSourceSelector — Post only, always visible */}
            {selectedType === 'post' && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DataSourceSelector
                  options={{ usePersona, includeTrending, remarketContent }}
                  onChange={(upd) => {
                    if (upd.usePersona !== undefined) setUsePersona(upd.usePersona);
                    if (upd.includeTrending !== undefined) setIncludeTrending(upd.includeTrending);
                    if (upd.remarketContent !== undefined) setRemarketContent(upd.remarketContent);
                  }}
                  connected={connected}
                />
              </div>
            )}

        {/* Advanced Options (Industry, Tone, Target Audience) */}
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setAdvancedOpen(prev => !prev)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
              background: '#f9fafb', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: '#374151', transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; }}
          >
            <span>Advanced Options</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{advancedOpen ? '▲' : '▼'}</span>
          </button>
          {advancedOpen && (
            <div style={{
              marginTop: 8, padding: 12, border: '1px solid #e5e7eb',
              borderRadius: 8, background: '#fff',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12, color: '#374151' }}>Industry</label>
                  <select
                    value={formData.industry}
                    onChange={e => setField('industry', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white' }}
                  >
                    {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
                <div>
                  <CustomToneSelect
                    tone={formData.tone}
                    customTone={formData.custom_tone}
                    presets={TONES}
                    onChange={({ tone, custom_tone }) => {
                      setField('tone', tone);
                      setField('custom_tone', custom_tone ?? '');
                    }}
                    labelStyle={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12, color: '#374151' }}
                    selectStyle={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white' }}
                    inputStyle={{ width: '100%', marginTop: 8, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12, color: '#374151' }}>Target Audience</label>
                <input
                  value={formData.target_audience}
                  onChange={e => setField('target_audience', e.target.value)}
                  placeholder="e.g., Product Managers, CTOs"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}
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
                toneLabel={resolvePersonaTone({ tone: formData.tone, custom_tone: formData.custom_tone })}
              />
            )}
            <PostFormatPicker
              selected={formData.post_type}
              onSelect={value => setField('post_type', value)}
            />
            {commonFields}
            {referenceContext && referenceMode && (
              <ReferencePostContextBanner
                mode={referenceMode}
                referenceContext={referenceContext}
              />
            )}
            <KeyPointsSection
              topic={formData.topic}
              industry={formData.industry}
              tone={resolvePersonaTone({ tone: formData.tone, custom_tone: formData.custom_tone })}
              targetAudience={formData.target_audience}
              keyPoints={formData.key_points}
              onChange={value => setField('key_points', value)}
              referenceContext={referenceContext ?? undefined}
            />
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
  }, [selectedType, formData, topicError, personaInfo, advancedOpen, setField, closeModal, savedCount, brainstorming, openModal, usePersona, includeTrending, remarketContent, connected, referenceContext, referenceMode]);

  const showInlineGrid = variant === 'default';

  return (
    <><div style={{ width: '100%', marginTop: showInlineGrid ? 8 : 0 }}>
      {showInlineGrid && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, textAlign: 'center' }}>Quick Create</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {CONTENT_TYPES.map(({ type, label, icon, description, color }) => {
              const locked = isCreateWedgeContentTypeLocked(type);
              if (locked) {
                return (
                  <div key={type} className="create-wedge-coming-soon-grid-cell">
                    <CreateWedgeComingSoonTile
                      contentType={type as CreateWedgeLockedContentType}
                      icon={icon}
                      title={label}
                      description={description}
                      notified={notifyRequested[type as CreateWedgeLockedContentType]}
                      onNotify={() =>
                        handleNotify(type as CreateWedgeLockedContentType, label)
                      }
                    />
                  </div>
                );
              }
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => openModal(type)}
                  aria-label={`Create ${label}`}
                  className="linkedin-quick-create-type-card"
                  style={{
                    padding: '14px 10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
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
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: '1.3' }}>
                    {description}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Generation Modal — portaled to body so it layers above the right-rail tools */}
      {selectedType && createPortal(
        <div
          className="linkedin-quick-create-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="linkedin-quick-create-title"
          onClick={() => {
            if (myIdeasOpen || postTodayOpen) return;
            closeModal();
          }}
        >
          <div
            className={[
              'linkedin-quick-create-dialog',
              variationsPhase !== 'idle' ? 'linkedin-quick-create-dialog--variations' : '',
              selectedType === 'post' ? 'linkedin-quick-create-dialog--plan-size' : '',
            ].filter(Boolean).join(' ')}
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal header — title row, then optional back navigation below */}
            <div className="linkedin-quick-create-header">
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    width: '100%',
                  }}
                >
                  {selectedType === 'post' && variationsPhase === 'idle' ? (
                    <div
                      id="linkedin-quick-create-title"
                      className="linkedin-quick-create-title linkedin-quick-create-title--xl"
                    >
                      <span className="linkedin-quick-create-title__icon" aria-hidden>📝</span>
                      <span className="linkedin-quick-create-title__text">Post</span>
                    </div>
                  ) : selectedType === 'article' && variationsPhase === 'idle' ? (
                    <div
                      id="linkedin-quick-create-title"
                      className="linkedin-quick-create-title linkedin-quick-create-title--xl linkedin-quick-create-title--article"
                    >
                      <span
                        className="linkedin-quick-create-title__icon linkedin-quick-create-title__icon--article"
                        aria-hidden
                      >
                        📄
                      </span>
                      <span className="linkedin-quick-create-title__text">Article</span>
                    </div>
                  ) : (
                    <div
                      id="linkedin-quick-create-title"
                      className="linkedin-quick-create-title"
                    >
                      {CONTENT_TYPES.find(c => c.type === selectedType)?.icon}{' '}
                      {variationsPhase !== 'idle'
                        ? '3 Tone Variations'
                        : CONTENT_TYPES.find(c => c.type === selectedType)?.label}
                    </div>
                  )}
                  <StudioModalCloseButton onClick={closeModal} ariaLabel="Close quick create" />
                </div>
                {returnTo && (
                  <DashboardModalBackButton
                    label={returnTo.label}
                    onClick={handleBackNavigation}
                  />
                )}
              </div>
            </div>

            {/* Modal body — swaps to VariationPicker when in variations phase */}
            <div className="linkedin-quick-create-body">
              {generationError && (
                <p style={{ margin: '0 0 12px', color: '#b91c1c', fontSize: 13, fontWeight: 500 }}>
                  {generationError}
                </p>
              )}
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
              <div className="linkedin-quick-create-footer">
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
                {selectedType === 'article' && !outlineMode && (
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
                      color: outlinePlanMode ? '#057642' : '#6b7280',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={outlinePlanMode}
                      onChange={e => setOutlinePlanMode(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: '#057642', cursor: 'pointer' }}
                    />
                    Plan sections first
                    {outlinePlanMode && (
                      <span style={{ fontSize: 10, background: '#ecfdf5', color: '#057642', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                        HITL
                      </span>
                    )}
                  </label>
                )}
                {selectedType !== 'post' && selectedType !== 'article' && <div style={{ flex: 1 }} />}

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
                    background: generating ? '#9ca3af' : variationsMode ? '#6366f1' : outlinePlanMode ? '#057642' : (CONTENT_TYPES.find(c => c.type === selectedType)?.color || '#0a66c2'),
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
                  {generating ? 'Generating...' : variationsMode ? '✦ Generate 3 Variations' : outlinePlanMode ? '✦ Plan Sections' : 'Generate'}
                </button>
              </div>
            )}

            {/* Variations footer — only shown while results are ready */}
            {variationsPhase === 'ready' && (
              <div className="linkedin-quick-create-footer linkedin-quick-create-footer--end">
                <button
                  onClick={closeModal}
                  style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
                >
                  Close without selecting
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>

      <MySavedIdeas
        open={myIdeasOpen}
        onClose={() => setMyIdeasOpen(false)}
        stacked={Boolean(selectedType === 'post' || selectedType === 'article')}
        onAfterDelete={() => void refreshSavedCount()}
        onUseInCopilot={(prompt: string) => {
          setMyIdeasOpen(false);
          setField('topic', prompt);
        }}
      />

      <PostTodayModal
        open={postTodayOpen}
        onClose={() => setPostTodayOpen(false)}
        stacked={selectedType === 'post'}
        onApplyCandidate={(topic, hook) => {
          setField('topic', topic);
          if (hook) setField('key_points', hook);
        }}
      />
    </>
  );
};
