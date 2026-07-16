import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformPersonaContext } from '../../shared/PersonaContext/PlatformPersonaProvider';
import { apiClient, aiApiClient } from '../../../api/client';
import '../../../types/linkedinWriterEvents';
import MySavedIdeas, { type SavedBrainstormIdea } from './Brainstorm/MySavedIdeas';
import PersonalizedIdeasPanel, { type PersonalizedIdeaItem } from './Brainstorm/PersonalizedIdeasPanel';
import { StudioModalCloseButton } from './dashboard/StudioModalCloseButton';
import { LI_Z_MODAL } from '../utils/linkedInStudioZIndex';

interface BrainstormOptions {
  usePersona: boolean;
  includeTrending: boolean;
  remarketContent: boolean;
}

interface BrainstormFlowProps {
  brainstormVisible: boolean;
  setBrainstormVisible: React.Dispatch<React.SetStateAction<boolean>>;
  onBackToOptions?: () => void;
}

interface BrainstormIdea {
  prompt: string;
  rationale?: string;
  evidence?: string;
  source_index?: number;
}

interface BrainstormSource {
  title: string;
  url: string;
  snippet: string;
}

interface BrainstormCacheData {
  ideas: BrainstormIdea[];
  sources: BrainstormSource[];
  timestamp: number;
}

const isBrainstormCacheData = (data: any): data is BrainstormCacheData =>
  data && Array.isArray(data.ideas) && typeof data.timestamp === 'number';

const BrainstormFlow: React.FC<BrainstormFlowProps> = ({
  brainstormVisible,
  setBrainstormVisible,
  onBackToOptions,
}) => {
  const { corePersona, platformPersona } = usePlatformPersonaContext();

  const [stage, setStage] = useState<'idle' | 'loading' | 'results'>('idle');
  const [ideas, setIdeas] = useState<BrainstormIdea[]>([]);
  const [sources, setSources] = useState<BrainstormSource[]>([]);
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // ── Personalization state ──
  const [personalizedStage, setPersonalizedStage] = useState<'idle' | 'loading' | 'results'>('idle');
  const [personalizedIdeas, setPersonalizedIdeas] = useState<PersonalizedIdeaItem[]>([]);
  const [personalizedDataSummary, setPersonalizedDataSummary] = useState('');
  const [personalizedError, setPersonalizedError] = useState<string | null>(null);
  const lastPersonalizeOptionsRef = useRef<{ seed: string; options: BrainstormOptions } | null>(null);
  const lastSeedRef = useRef<string>('');

  const brainstormTypeRef = useRef<string>('post');
  const brainstormIndustryRef = useRef<string>('');
  const brainstormToneRef = useRef<string>('');
  const brainstormTargetAudienceRef = useRef<string>('');
  const isProcessingRef = useRef(false);
  const processingQueueRef = useRef<Event | null>(null);

  const [savedPromptHashes, setSavedPromptHashes] = useState<Set<string>>(() => new Set());
  const [savedCount, setSavedCount] = useState<number>(0);
  const [myIdeasOpen, setMyIdeasOpen] = useState<boolean>(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const hashPrompt = useCallback((p: string) => p.trim().toLowerCase(), []);

  const refreshSavedCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/brainstorm/saved-ideas', {
        params: { limit: 100, offset: 0 },
      });
      const total = Number(res.data?.total) || 0;
      setSavedCount(total);
      if (Array.isArray(res.data?.ideas)) {
        setSavedPromptHashes(new Set(res.data.ideas.map((it: SavedBrainstormIdea) => hashPrompt(it.prompt))));
      }
    } catch { /* best-effort */ }
  }, [hashPrompt]);

  useEffect(() => {
    void refreshSavedCount();
  }, [refreshSavedCount]);

  const handleSaveIdea = useCallback(
    async (idx: number) => {
      const idea = ideas[idx];
      if (!idea) return;
      const prompt = idea.prompt?.trim() || '';
      if (!prompt) return;
      const hash = hashPrompt(prompt);
      if (savedPromptHashes.has(hash)) return;
      setSavingIndex(idx);
      setSaveError(null);
      try {
        await apiClient.post('/api/brainstorm/saved-ideas', {
          prompt,
          rationale: idea.rationale || '',
          source_seed: (window.lastBrainstormEvent?.detail as any)?.seed || '',
        });
        setSavedPromptHashes((prev) => { const n = new Set(prev); n.add(hash); return n; });
        setSavedCount((c) => c + 1);
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => setSavingIndex(null), 1200);
      } catch (e: any) {
        setSaveError(e?.response?.data?.detail || e?.message || 'Failed to save idea');
        setSavingIndex(null);
      }
    },
    [ideas, savedPromptHashes, hashPrompt]
  );

  const loaderMessages = useMemo(() => [
    'Searching the web for recent coverage...',
    'Analyzing content and extracting insights...',
    'Aligning findings with your persona...',
    'Formulating high-signal brainstorm prompts...',
  ], []);

  const getCacheKey = useCallback((seed: string, personaId?: string, platformPersonaId?: string) =>
    `brainstorm_ideas_${seed}_${personaId || 'default'}_${platformPersonaId || 'default'}`, []);

  const getCachedIdeas = useCallback((cacheKey: string): BrainstormCacheData | null => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (isBrainstormCacheData(data) && Date.now() - data.timestamp < 3600000) return data;
        else sessionStorage.removeItem(cacheKey);
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const setCachedIdeas = useCallback((cacheKey: string, data: BrainstormIdea[], src?: BrainstormSource[]) => {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ ideas: data, sources: src || [], timestamp: Date.now() }));
    } catch { /* ignore */ }
  }, []);

  const clearCache = useCallback(() => {
    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('brainstorm_ideas_')) sessionStorage.removeItem(key);
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const handler = async (ev: any) => {
      if (isProcessingRef.current) {
        processingQueueRef.current = ev;
        return;
      }
      isProcessingRef.current = true;
      processingQueueRef.current = null;
      console.log('[BrainstormFlow] event received, detail:', ev?.detail);
      // Tell QuickCreate to clear its safety timeout — BrainstormFlow is live
      window.dispatchEvent(new CustomEvent('linkedinwriter:brainstormStarted'));
      try {
        setBrainstormVisible(true);
        window.lastBrainstormEvent = ev;
        const { prompt, seed: ideaSeed, type: brainstormType, forceRefresh = false, options, industry, tone, target_audience } = ev.detail || {};
        brainstormTypeRef.current = brainstormType || 'post';
        brainstormIndustryRef.current = industry || '';
        brainstormToneRef.current = tone || '';
        brainstormTargetAudienceRef.current = target_audience || '';
        const finalSeed = ideaSeed || prompt || '';
        console.log('[BrainstormFlow] finalSeed:', JSON.stringify(finalSeed), 'hasOptions:', !!options && (options.usePersona || options.includeTrending || options.remarketContent));

        // Special case: 'cached' means show most recent cached ideas without API call
        if (finalSeed === 'cached') {
          let mostRecent: BrainstormCacheData | null = null;
          let mostRecentTs = 0;
          for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith('brainstorm_ideas_')) {
              try {
                const data = JSON.parse(sessionStorage.getItem(key) || '');
                if (isBrainstormCacheData(data) && data.timestamp > mostRecentTs && data.ideas.length > 0) {
                  mostRecentTs = data.timestamp;
                  mostRecent = data;
                }
              } catch { /* skip */ }
            }
          }
          if (mostRecent) {
            setIdeas(mostRecent.ideas);
            setIsUsingCache(true);
            setStage('results');
          } else {
            setBrainstormVisible(false);
          }
          return;
        }

        const hasOptions = options && (options.usePersona || options.includeTrending || options.remarketContent);

        // If no seed and no options, nothing to do
        if (!finalSeed && !hasOptions) return;

        // Route: options-based → /personalized-ideas, seed-only → /ideas
        if (hasOptions) {
          setStage('loading');
          setLoaderMessageIndex(0);
          lastPersonalizeOptionsRef.current = { seed: finalSeed || '', options: { usePersona: options.usePersona || false, includeTrending: options.includeTrending || false, remarketContent: options.remarketContent || false } };
          try {
            const res = await aiApiClient.post('/api/brainstorm/personalized-ideas', {
              seed: finalSeed || '',
              count: 5,
              include_trending: options.includeTrending || false,
              remarket_content: options.remarketContent || false,
              use_persona: options.usePersona || false,
            });
            const list = Array.isArray(res.data?.ideas) ? res.data.ideas : [];
            setPersonalizedIdeas(list);
            const summary = res.data?.data_summary || '';
            setPersonalizedDataSummary(summary);
            if (list.length > 0) {
              setPersonalizedStage('results');
            } else {
              setPersonalizedStage('idle');
              setPersonalizedError(summary || 'No personalized ideas could be generated. Try different options or connect LinkedIn.');
            }
            setStage('idle');
          } catch (e: any) {
            setPersonalizedError(e?.response?.data?.detail || e?.message || 'Failed to generate personalized ideas');
            setPersonalizedDataSummary('');
            setPersonalizedStage('idle');
            setStage('idle');
          }
          return;
        }

        // Seed-only path (existing behavior)
        setStage('loading');
        setLoaderMessageIndex(0);

        const personaId = corePersona?.id?.toString();
        const platformPersonaId = platformPersona?.id?.toString();
        const cacheKey = getCacheKey(finalSeed, personaId, platformPersonaId);

        if (!forceRefresh) {
          const cached = getCachedIdeas(cacheKey);
          if (cached) {
            setIdeas(cached.ideas);
            setSources(cached.sources || []);
            setIsUsingCache(true);
            setStage('results');
            return;
          }
        }
        setIsUsingCache(false);

        const interval = setInterval(() => {
          setLoaderMessageIndex((idx) => Math.min(idx + 1, loaderMessages.length - 1));
        }, 700);

        try {
          const ir = await aiApiClient.post('/api/brainstorm/ideas', {
            seed: finalSeed,
            persona: corePersona || null,
            platformPersona: platformPersona || null,
            count: 5,
          });
          clearInterval(interval);
          setSeedError(null);
          const list = Array.isArray(ir.data?.ideas) ? ir.data.ideas : [];
          const srcList = Array.isArray(ir.data?.sources) ? ir.data.sources : [];
          setIdeas(list);
          setSources(srcList);
          if (list.length > 0) setCachedIdeas(cacheKey, list, srcList);
        } catch (e: any) {
          clearInterval(interval);
          setSeedError(e?.response?.data?.detail || e?.message || 'Failed to generate brainstorm ideas');
          setIdeas([]);
          lastSeedRef.current = finalSeed;
        }

        setStage('results');
      } catch (e) {
        console.error('Brainstorm flow error:', e);
        window.dispatchEvent(new CustomEvent('linkedinwriter:cancelBrainstorm'));
        setBrainstormVisible(false);
        setStage('idle');
      } finally {
        isProcessingRef.current = false;
        const queued = processingQueueRef.current;
        processingQueueRef.current = null;
        if (queued) {
          handler(queued);
        }
      }
    };
    window.addEventListener('linkedinwriter:runBrainstormIdeas', handler);
    return () => window.removeEventListener('linkedinwriter:runBrainstormIdeas', handler);
  }, [corePersona, platformPersona, loaderMessages, getCacheKey, getCachedIdeas, setCachedIdeas, setBrainstormVisible]);

  const handleClose = useCallback(() => {
    window.dispatchEvent(new CustomEvent('linkedinwriter:cancelBrainstorm'));
    setBrainstormVisible(false);
    setStage('idle');
    setIdeas([]);
    setSeedError(null);
    setPersonalizedStage('idle');
    setPersonalizedIdeas([]);
    setPersonalizedDataSummary('');
    setPersonalizedError(null);
  }, [setBrainstormVisible]);

  const handleGeneratePost = useCallback((prompt: string, contentType: string = 'post') => {
    window.dispatchEvent(new CustomEvent('linkedinwriter:openQuickCreate', {
      detail: {
        type: contentType,
        topic: prompt,
        industry: brainstormIndustryRef.current || undefined,
        tone: brainstormToneRef.current || undefined,
        target_audience: brainstormTargetAudienceRef.current || undefined,
      },
    }));
    handleClose();
  }, [handleClose]);

  const handleRefreshPersonalized = useCallback(async () => {
    const last = lastPersonalizeOptionsRef.current;
    if (!last) return;
    setPersonalizedStage('loading');
    setPersonalizedError(null);
    try {
      const res = await aiApiClient.post('/api/brainstorm/personalized-ideas', {
        seed: last.seed,
        count: 5,
        include_trending: last.options.includeTrending,
        remarket_content: last.options.remarketContent,
        use_persona: last.options.usePersona,
      });
      const list = Array.isArray(res.data?.ideas) ? res.data.ideas : [];
      setPersonalizedIdeas(list);
      const summary = res.data?.data_summary || '';
      setPersonalizedDataSummary(summary);
      if (list.length > 0) {
        setPersonalizedStage('results');
      } else {
        setPersonalizedStage('idle');
        setPersonalizedError(summary || 'No personalized ideas could be generated. Try different options or connect LinkedIn.');
      }
    } catch (e: any) {
      setPersonalizedError(e?.response?.data?.detail || e?.message || 'Failed to generate personalized ideas');
      setPersonalizedDataSummary('');
      setPersonalizedStage('idle');
    }
  }, []);

  // Show cached ideas when opened with "View Previous Ideas"
  useEffect(() => {
    if (!brainstormVisible) return;
    // If no event was dispatched but modal is visible, check for cached ideas
    if (stage === 'idle' && brainstormVisible) {
      // This handles the case where Header opens the modal without dispatching the event
      // The Header will dispatch the event which the above handler catches
    }
  }, [brainstormVisible, stage]);

  if (!brainstormVisible) return null;

  return (
    <>
      {createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: LI_Z_MODAL, padding: 20 }}
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label="Brainstorm ideas"
        >
          <div style={{
          background: 'white',
          width: 800,
          maxWidth: '100%',
          height: '90vh',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed Header */}
          <div style={{
            padding: '16px 20px',
            background: '#0a66c2',
            color: 'white',
            fontWeight: 800,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div>Brainstorm Ideas</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setMyIdeasOpen(true)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                📚 My Ideas{savedCount > 0 ? ` (${savedCount})` : ''}
              </button>
              {saveError && (
                <span style={{ background: 'rgba(254,226,226,0.95)', color: '#b91c1c', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600 }}>
                  save failed
                </span>
              )}
              <button
                onClick={clearCache}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                title="Clear cached ideas"
              >
                🗑️
              </button>
              <StudioModalCloseButton
                onClick={handleClose}
                ariaLabel="Close brainstorm"
                className="linkedin-studio-modal-close linkedin-studio-modal-close--on-dark"
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {stage === 'loading' && (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #0a66c2', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#111827' }}>Generating ideas</div>
                    <div style={{ marginTop: 6, color: '#374151', fontSize: 14 }}>{loaderMessages[loaderMessageIndex]}</div>
                  </div>
                </div>
                <ul style={{ margin: '12px 0 0 28px', color: '#6b7280', fontSize: 12, lineHeight: 1.6 }}>
                  <li>Searching the web via Exa</li>
                  <li>Analyzing content and extracting insights</li>
                  <li>Tailoring to your persona</li>
                  <li>Formulating brainstorm prompts</li>
                </ul>
                <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
              </div>
            )}

            {stage === 'results' && (
              <div style={{ padding: 20 }}>
                {seedError ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>Failed to generate ideas</div>
                    <div style={{ color: '#b91c1c', fontSize: 13, lineHeight: 1.5, marginBottom: 20, background: '#fef2f2', padding: '12px 16px', borderRadius: 8, display: 'inline-block', textAlign: 'left', maxWidth: 420, border: '1px solid #fecaca' }}>
                      {seedError}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button
                        onClick={handleClose}
                        style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Close
                      </button>
                      <button
                        onClick={() => {
                          setSeedError(null);
                          setStage('idle');
                          window.dispatchEvent(new CustomEvent('linkedinwriter:runBrainstormIdeas', {
                            detail: {
                              seed: lastSeedRef.current,
                              forceRefresh: true,
                            },
                          }));
                        }}
                        style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#0a66c2', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        🔄 Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 16, fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {ideas.length > 0 ? 'Your brainstorm ideas' : 'No ideas found. Try a different topic.'}
                      {isUsingCache && (
                        <span style={{ fontSize: 12, color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
                          📦 Cached
                        </span>
                      )}
                    </div>
                    {ideas.length > 0 && (
                      <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                        {ideas.map((idea, i) => {
                          const isSaved = savedPromptHashes.has(hashPrompt(idea.prompt));
                          const isSavingThis = savingIndex === i;
                          return (
                            <div
                              key={i}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                gap: 12,
                                alignItems: 'flex-start',
                                border: '1px solid #e5e7eb',
                                borderRadius: 10,
                                padding: '14px 18px',
                                background: '#ffffff',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 14, color: '#111827', fontWeight: 600, lineHeight: 1.4 }}>
                                  {idea.prompt}
                                </div>
                                {idea.rationale && (
                                  <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12, lineHeight: 1.3 }}>
                                    {idea.rationale}
                                  </div>
                                )}
                                {idea.evidence && (
                                  <div style={{ marginTop: 6, color: '#0891b2', fontSize: 11, lineHeight: 1.3, background: '#ecfeff', padding: '6px 10px', borderRadius: 6 }}>
                                    📊 {idea.evidence}
                                  </div>
                                )}
                                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleGeneratePost(idea.prompt, 'post')}
                                    style={{
                                      padding: '4px 12px',
                                      borderRadius: 6,
                                      border: 'none',
                                      background: '#0a66c2',
                                      color: 'white',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Generate Post
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleGeneratePost(idea.prompt, 'article')}
                                    style={{
                                      padding: '4px 12px',
                                      borderRadius: 6,
                                      border: 'none',
                                      background: '#057642',
                                      color: 'white',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Generate Article
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); void handleSaveIdea(i); }}
                                disabled={isSaved || isSavingThis}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: isSaved ? '1px solid #6ee7b7' : '1px solid #0a66c2',
                                  background: isSaved ? '#d1fae5' : '#ffffff',
                                  color: isSaved ? '#047857' : '#0a66c2',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: isSaved ? 'default' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  alignSelf: 'flex-start',
                                }}
                              >
                                {isSaved ? '✓ Saved' : isSavingThis ? 'Saving…' : '🔖 Save'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {sources.length > 0 && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
                          📰 Sources used ({sources.length})
                        </summary>
                        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                          {sources.map((src, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#4b5563', background: '#f9fafb', padding: '8px 10px', borderRadius: 6, border: '1px solid #f3f4f6' }}>
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                                Source {i + 1}: {src.title}
                              </div>
                              <div style={{ color: '#6b7280' }}>{src.snippet}</div>
                              <a href={src.url} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#0a66c2', textDecoration: 'underline', fontSize: 10 }}
                                onClick={(e) => e.stopPropagation()}>
                                Read more ↗
                              </a>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}

            {personalizedStage === 'loading' && (() => {
              const opts = lastPersonalizeOptionsRef.current?.options;
              const hasPersona = opts?.usePersona ?? false;
              const hasTrending = opts?.includeTrending ?? false;
              const hasRemarket = opts?.remarketContent ?? false;
              const items: string[] = [];
              if (hasPersona) items.push('Reading your LinkedIn profile & communication style');
              if (hasTrending) items.push('Scanning industry trends & growth insights');
              if (hasRemarket) items.push('Reviewing your generated content & saved ideas');
              if (!items.length) items.push('Checking your account data');
              items.push('Formulating personalized angles');
              return (
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #0a66c2', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    <div>
                      <div style={{ fontWeight: 800, color: '#111827' }}>Analyzing your data</div>
                      <div style={{ marginTop: 6, color: '#374151', fontSize: 14 }}>Gathering insights from your selected sources...</div>
                    </div>
                  </div>
                  <ul style={{ margin: '12px 0 0 28px', color: '#6b7280', fontSize: 12, lineHeight: 1.6 }}>
                    {items.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                  <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                </div>
              );
            })()}

            {personalizedStage === 'results' && personalizedIdeas.length > 0 && (
              <PersonalizedIdeasPanel
                ideas={personalizedIdeas}
                dataSummary={personalizedDataSummary}
                onGeneratePost={handleGeneratePost}
                onRefresh={handleRefreshPersonalized}
                onBack={onBackToOptions}
              />
            )}

            {personalizedError && stage === 'idle' && (
              <div style={{ padding: 24, textAlign: 'center' }}>
                {onBackToOptions && (
                  <div style={{ textAlign: 'left', marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => { setPersonalizedError(null); onBackToOptions(); }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: 'white',
                        color: '#374151',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ← Back to options
                    </button>
                  </div>
                )}
                <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>No ideas generated</div>
                <div style={{ color: '#374151', fontSize: 13, lineHeight: 1.5, marginBottom: 16, background: '#f9fafb', padding: '12px 16px', borderRadius: 8, display: 'inline-block', textAlign: 'left', maxWidth: 420 }}>
                  {personalizedError}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => { setPersonalizedError(null); }}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: 'white',
                      color: '#374151',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginRight: 8,
                    }}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonalizedError(null);
                      if (lastPersonalizeOptionsRef.current) {
                        window.dispatchEvent(new CustomEvent('linkedinwriter:runBrainstormIdeas', {
                          detail: {
                            seed: lastPersonalizeOptionsRef.current.seed,
                            options: lastPersonalizeOptionsRef.current.options,
                            forceRefresh: true,
                          },
                        }));
                      }
                    }}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#0a66c2',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Retry
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          {stage === 'results' && (
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
              backgroundColor: '#f9fafb'
            }}>
              <button onClick={handleClose} style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: 'white',
                border: '1px solid #e5e7eb',
                cursor: 'pointer',
                fontWeight: 600
              }}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body
      )}

      <MySavedIdeas
        open={myIdeasOpen}
        onClose={() => setMyIdeasOpen(false)}
        onAfterDelete={() => void refreshSavedCount()}
        onUseInCopilot={(prompt: string) => {
          window.dispatchEvent(new CustomEvent('linkedinwriter:copilotSeedFromPrompt', { detail: { prompt } }));
          setMyIdeasOpen(false);
          handleClose();
        }}
      />
    </>
  );
};

export default BrainstormFlow;
