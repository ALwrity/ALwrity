import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlatformPersonaContext } from '../../shared/PersonaContext/PlatformPersonaProvider';
import { apiClient } from '../../../api/client';
import '../../../types/linkedinWriterEvents';
import MySavedIdeas, { type SavedBrainstormIdea } from './Brainstorm/MySavedIdeas';

// Define the cache data type
interface BrainstormCacheData {
  ideas: { prompt: string; rationale?: string }[];
  searchResults: any[];
  timestamp: number;
}

// Type guard function
const isBrainstormCacheData = (data: any): data is BrainstormCacheData => {
  return data && 
         Array.isArray(data.ideas) && 
         Array.isArray(data.searchResults) && 
         typeof data.timestamp === 'number';
};

interface BrainstormFlowProps {
  brainstormVisible: boolean;
  setBrainstormVisible: React.Dispatch<React.SetStateAction<boolean>>;
  brainstormStage: 'loading' | 'select' | 'results';
  setBrainstormStage: React.Dispatch<React.SetStateAction<'loading' | 'select' | 'results'>>;
  loaderMessageIndex: number;
  setLoaderMessageIndex: React.Dispatch<React.SetStateAction<number>>;
  aiSearchPrompts: string[];
  setAiSearchPrompts: React.Dispatch<React.SetStateAction<string[]>>;
  selectedPrompt: string;
  setSelectedPrompt: React.Dispatch<React.SetStateAction<string>>;
  searchResults: any[];
  setSearchResults: React.Dispatch<React.SetStateAction<any[]>>;
  ideas: { prompt: string; rationale?: string }[];
  setIdeas: React.Dispatch<React.SetStateAction<{ prompt: string; rationale?: string }[]>>;
  isUsingCache: boolean;
  setIsUsingCache: React.Dispatch<React.SetStateAction<boolean>>;
}

const BrainstormFlow: React.FC<BrainstormFlowProps> = ({
  brainstormVisible,
  setBrainstormVisible,
  brainstormStage,
  setBrainstormStage,
  loaderMessageIndex,
  setLoaderMessageIndex,
  aiSearchPrompts,
  setAiSearchPrompts,
  selectedPrompt,
  setSelectedPrompt,
  searchResults,
  setSearchResults,
  ideas,
  setIdeas,
  isUsingCache,
  setIsUsingCache
}) => {
  const { corePersona, platformPersona } = usePlatformPersonaContext();

  // Track which idea prompts the user has already saved in this session,
  // so the "Save" button can flip to "Saved ✓" without re-fetching the
  // server list. The source of truth is still the backend; this is just
  // a UI hint to avoid duplicate POSTs.
  const [savedPromptHashes, setSavedPromptHashes] = useState<Set<string>>(() => new Set());
  // A monotonic counter that increments on every successful save; we
  // surface it as the badge count on the "My Ideas (N)" button.
  const [savedCount, setSavedCount] = useState<number>(0);
  const [myIdeasOpen, setMyIdeasOpen] = useState<boolean>(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Debounce timer for saved feedback so rapid clicks don't flicker.
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
        const ideas: SavedBrainstormIdea[] = res.data.ideas;
        setSavedPromptHashes(new Set(ideas.map((it) => hashPrompt(it.prompt))));
      }
    } catch {
      // Silent: count is best-effort; the user can still open the modal.
    }
  }, [hashPrompt]);

  // Best-effort load on mount so the "My Ideas (N)" badge is populated.
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
      if (savedPromptHashes.has(hash)) {
        return; // Already saved this session.
      }
      setSavingIndex(idx);
      setSaveError(null);
      try {
        await apiClient.post('/api/brainstorm/saved-ideas', {
          prompt,
          rationale: idea.rationale || '',
          source_seed:
            (window.lastBrainstormEvent?.detail?.seed as string | undefined) || '',
        });
        setSavedPromptHashes((prev) => {
          const next = new Set(prev);
          next.add(hash);
          return next;
        });
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

  const loaderMessages = useMemo(() => ([
    'Searching the web for the most recent and relevant coverage...',
    'Extracting entities and context from top sources...',
    'Aligning findings with your persona and audience...',
    'Formulating high-signal brainstorm prompts you can use right away...'
  ]), []);

  // Cache management utilities
  const getCacheKey = useCallback((seed: string, personaId?: string, platformPersonaId?: string) => {
    return `brainstorm_ideas_${seed}_${personaId || 'default'}_${platformPersonaId || 'default'}`;
  }, []);

  const getCachedIdeas = useCallback((cacheKey: string): BrainstormCacheData | null => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (isBrainstormCacheData(data)) {
          // Check if cache is less than 1 hour old
          if (Date.now() - data.timestamp < 3600000) {
            return data;
          } else {
            sessionStorage.removeItem(cacheKey);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read brainstorm cache:', e);
    }
    return null;
  }, []);

  const setCachedIdeas = useCallback((cacheKey: string, ideas: any[], searchResults: any[]) => {
    try {
      const cacheData = {
        ideas,
        searchResults,
        timestamp: Date.now()
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to cache brainstorm ideas:', e);
    }
  }, []);

  const clearCache = useCallback(() => {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('brainstorm_ideas_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear brainstorm cache:', e);
    }
  }, []);

  React.useEffect(() => {
    const handler = async (ev: any) => {
      try {
        // Store the event for refresh functionality
        window.lastBrainstormEvent = ev;
        
        const { prompt, seed: ideaSeed, forceRefresh = false } = ev.detail || {};
        const finalSeed = ideaSeed || prompt;
        
        setBrainstormVisible(true);
        setBrainstormStage('loading');
        setLoaderMessageIndex(0);

        // Special case: show most recent cached ideas when seed is 'cached'
        if (finalSeed === 'cached') {
          try {
            const keys = Object.keys(sessionStorage);
            let mostRecentCache: BrainstormCacheData | null = null;
            let mostRecentKey = '';
            let mostRecentTimestamp = 0;
            
            for (const key of keys) {
              if (key.startsWith('brainstorm_ideas_')) {
                const cached = sessionStorage.getItem(key);
                if (cached) {
                  const data = JSON.parse(cached);
                  if (isBrainstormCacheData(data) && data.timestamp > mostRecentTimestamp && data.ideas.length > 0) {
                    mostRecentTimestamp = data.timestamp;
                    mostRecentCache = data;
                    mostRecentKey = key;
                  }
                }
              }
            }
            
            if (mostRecentCache !== null) {
              console.log('Showing most recent cached brainstorm ideas from:', mostRecentKey);
              setIdeas(mostRecentCache.ideas);
              setAiSearchPrompts(mostRecentCache.ideas.map((x) => x.prompt));
              setSelectedPrompt(mostRecentCache.ideas[0]?.prompt || '');
              setSearchResults(mostRecentCache.searchResults || []);
              setIsUsingCache(true);
              setBrainstormStage('select');
              return;
            } else {
              // No cached ideas found, close modal
              setBrainstormVisible(false);
              return;
            }
          } catch (e) {
            console.warn('Failed to load cached ideas:', e);
            setBrainstormVisible(false);
            return;
          }
        }

        // Check cache first (unless force refresh)
        const personaId = corePersona?.id?.toString();
        const platformPersonaId = platformPersona?.id?.toString();
        const cacheKey = getCacheKey(finalSeed, personaId, platformPersonaId);
        
        if (!forceRefresh) {
          const cached = getCachedIdeas(cacheKey);
          if (cached) {
            console.log('Using cached brainstorm ideas for:', finalSeed);
            setIdeas(cached.ideas);
            setAiSearchPrompts(cached.ideas.map((x) => x.prompt));
            setSelectedPrompt(cached.ideas[0]?.prompt || '');
            setSearchResults(cached.searchResults || []);
            setIsUsingCache(true);
            setBrainstormStage('select');
            return;
          }
        }
        
        setIsUsingCache(false);

        // Gentle loader progression
        let step = 0;
        const interval = setInterval(() => {
          step += 1;
          setLoaderMessageIndex((idx: number) => Math.min(idx + 1, loaderMessages.length - 1));
          if (step >= loaderMessages.length - 1) clearInterval(interval);
        }, 700);

        // First: run grounded search for the seed prompt
        let results: any[] = [];
        try {
          const sr = await apiClient.post('/api/brainstorm/search', { prompt: finalSeed });
          results = sr.data?.results || [];
        } catch {}
        setSearchResults(results);

        // Then: request persona-aware brainstorm ideas using the search results
        try {
          const ir = await apiClient.post('/api/brainstorm/ideas', {
            seed: finalSeed,
            persona: corePersona || null,
            platformPersona: platformPersona || null,
            results,
            count: 5
          });
          if (ir.data) {
            const data = ir.data;
            const list = Array.isArray(data?.ideas) ? data.ideas : [];
            setIdeas(list);
            setAiSearchPrompts(list.map((x: any) => x.prompt));
            setSelectedPrompt(list[0]?.prompt || '');
            
            // Cache the results
            setCachedIdeas(cacheKey, list, results);
            console.log('Cached brainstorm ideas for:', finalSeed);
          } else {
            setIdeas([]);
          }
        } catch {
          setIdeas([]);
        }

        setBrainstormStage('select');
      } catch (e) {
        console.error('Brainstorm flow error:', e);
        setBrainstormVisible(false);
      }
    };
    window.addEventListener('linkedinwriter:runGoogleSearchForIdeas', handler);
    return () => window.removeEventListener('linkedinwriter:runGoogleSearchForIdeas', handler);
  }, [corePersona, platformPersona, loaderMessages, getCacheKey, getCachedIdeas, setCachedIdeas, setBrainstormVisible, setBrainstormStage, setLoaderMessageIndex, setIdeas, setAiSearchPrompts, setSelectedPrompt, setSearchResults, setIsUsingCache]);

  return (
    <>
      {/* Brainstorm Flow UI */}
      {brainstormVisible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10010, padding: 20 }}>
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
          }}>
            {/* Fixed Header */}
            <div style={{ 
              padding: 16, 
              background: '#0a66c2', 
              color: 'white', 
              fontWeight: 800, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div>Brainstorm: Google Search Prompts</div>
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
                  title="View your saved brainstorm ideas"
                >
                  📚 My Ideas{savedCount > 0 ? ` (${savedCount})` : ''}
                </button>
                {saveError && (
                  <span
                    title={saveError}
                    style={{
                      background: 'rgba(254, 226, 226, 0.95)',
                      color: '#b91c1c',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    save failed
                  </span>
                )}
                <button
                  onClick={() => {
                    // Force refresh by clearing cache and re-running
                    const { prompt, seed: ideaSeed } = window.lastBrainstormEvent?.detail || {};
                    if (prompt || ideaSeed) {
                      window.dispatchEvent(new CustomEvent('linkedinwriter:runGoogleSearchForIdeas', { 
                        detail: { prompt, seed: ideaSeed, forceRefresh: true } 
                      }));
                    }
                  }}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    border: 'none', 
                    color: 'white', 
                    borderRadius: 6, 
                    padding: '4px 8px', 
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                  title="Refresh ideas (bypass cache)"
                >
                  🔄
                </button>
                <button
                  onClick={() => {
                    clearCache();
                    console.log('Brainstorm cache cleared');
                  }}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    border: 'none', 
                    color: 'white', 
                    borderRadius: 6, 
                    padding: '4px 8px', 
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                  title="Clear all cached brainstorm ideas"
                >
                  🗑️
                </button>
                <button 
                  onClick={() => {
                    setBrainstormVisible(false);
                    setBrainstormStage('loading');
                    setLoaderMessageIndex(0);
                    setAiSearchPrompts([]);
                    setSelectedPrompt('');
                    setSearchResults([]);
                    setIdeas([]);
                  }} 
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {brainstormStage === 'loading' && (
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #0a66c2', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    <div>
                      <div style={{ fontWeight: 800, color: '#111827' }}>Preparing Google search prompts</div>
                      <div style={{ marginTop: 6, color: '#374151', fontSize: 14 }}>{loaderMessages[loaderMessageIndex]}</div>
                    </div>
                  </div>
                  <ul style={{ margin: '12px 0 0 28px', color: '#6b7280', fontSize: 12, lineHeight: 1.6 }}>
                    <li>1/4 Persona-aware analysis</li>
                    <li>2/4 Seed expansion and entities</li>
                    <li>3/4 Grounding and timeliness checks</li>
                    <li>4/4 Output assembly</li>
                  </ul>
                  <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                </div>
              )}

              {brainstormStage === 'select' && (
                <div style={{ padding: 20 }}>
                  <div style={{ marginBottom: 16, fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Select one prompt to run with Google Search
                    {isUsingCache && (
                      <span style={{ 
                        fontSize: 12, 
                        color: '#059669', 
                        background: '#d1fae5', 
                        padding: '2px 8px', 
                        borderRadius: 12,
                        fontWeight: 500
                      }}>
                        📦 Cached
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                    {aiSearchPrompts.map((p, i) => {
                      const rationale = ideas[i]?.rationale;
                      const isSaved = savedPromptHashes.has(hashPrompt(p));
                      const isSavingThis = savingIndex === i;
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            gap: 12,
                            alignItems: 'flex-start',
                            border: '1px solid #e5e7eb',
                            borderRadius: 10,
                            padding: '12px 16px',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s',
                            background: selectedPrompt === p ? '#f0f9ff' : '#ffffff',
                            borderColor: selectedPrompt === p ? '#0a66c2' : '#e5e7eb',
                          }}
                          onClick={() => setSelectedPrompt(p)}
                        >
                          <input
                            type="radio"
                            name="aiPrompt"
                            checked={selectedPrompt === p}
                            onChange={() => setSelectedPrompt(p)}
                            style={{ marginTop: 3, cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontSize: 14, color: '#111827', fontWeight: 600, lineHeight: 1.4 }}>{p}</div>
                            {rationale && <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12, lineHeight: 1.3 }}>{rationale}</div>}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSaveIdea(i);
                            }}
                            disabled={isSaved || isSavingThis === i}
                            title={isSaved ? 'Already saved' : 'Save to My Ideas'}
                            style={{
                              alignSelf: 'flex-start',
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: isSaved
                                ? '1px solid #6ee7b7'
                                : '1px solid #0a66c2',
                              background: isSaved ? '#d1fae5' : '#ffffff',
                              color: isSaved ? '#047857' : '#0a66c2',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: isSaved ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isSaved ? '✓ Saved' : isSavingThis ? 'Saving…' : '🔖 Save'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {brainstormStage === 'results' && (
                <div style={{ padding: 20 }}>
                  <div style={{ marginBottom: 16, fontWeight: 700, color: '#1f2937' }}>Search Results</div>
                  {searchResults.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>No results or search unavailable. Try another prompt.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                      {searchResults.map((r: any, idx: number) => (
                        <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>{r.title || r.name || 'Result'}</div>
                          <div style={{ color: '#374151', fontSize: 13, lineHeight: 1.4 }}>{r.snippet || r.description || r.content || ''}</div>
                          {r.url && (<div style={{ marginTop: 6, fontSize: 12, color: '#2563eb' }}><a href={r.url} target="_blank" rel="noreferrer">{r.url}</a></div>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            {brainstormStage !== 'loading' && (
              <div style={{ 
                padding: '16px 20px', 
                borderTop: '1px solid #e5e7eb', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: 12,
                flexShrink: 0,
                backgroundColor: '#f9fafb'
              }}>
                {brainstormStage === 'select' && (
                  <>
                    <button
                      onClick={() => {
                        // Send prompt to copilot chat input to generate a post from this prompt
                        window.dispatchEvent(new CustomEvent('linkedinwriter:copilotSeedFromPrompt', { detail: { prompt: selectedPrompt } }));
                        setBrainstormVisible(false);
                      }}
                      disabled={!selectedPrompt}
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: 8, 
                        background: selectedPrompt ? '#111827' : '#9ca3af', 
                        color: 'white', 
                        border: 'none', 
                        cursor: selectedPrompt ? 'pointer' : 'not-allowed', 
                        fontWeight: 600 
                      }}
                    >
                      Generate post from this prompt
                    </button>
                    <button 
                      onClick={() => setBrainstormVisible(false)} 
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: 8, 
                        background: 'white', 
                        border: '1px solid #e5e7eb', 
                        cursor: 'pointer', 
                        fontWeight: 600 
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        // Use existing Google grounding flow via backend LinkedInService
                        try {
                          const resp = await apiClient.post('/api/brainstorm/search', { prompt: selectedPrompt });
                          setSearchResults(resp.data?.results || []);
                          setBrainstormStage('results');
                        } catch {
                          setSearchResults([]);
                          setBrainstormStage('results');
                        }
                      }}
                      disabled={!selectedPrompt}
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: 8, 
                        background: selectedPrompt ? '#0a66c2' : '#c7d2fe', 
                        color: 'white', 
                        border: 'none', 
                        cursor: selectedPrompt ? 'pointer' : 'not-allowed', 
                        fontWeight: 600 
                      }}
                    >
                      Run Google Search
                    </button>
                  </>
                )}

                {brainstormStage === 'results' && (
                  <>
                    <button
                      onClick={() => setBrainstormStage('select')}
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: 8, 
                        background: '#6b7280', 
                        color: 'white', 
                        border: 'none', 
                        cursor: 'pointer', 
                        fontWeight: 600 
                      }}
                    >
                      Back to Prompts
                    </button>
                    <button
                      onClick={() => {
                        // Seed Copilot chat to generate a post
                        window.dispatchEvent(new CustomEvent('linkedinwriter:copilotSeedFromPrompt', { detail: { prompt: selectedPrompt } }));
                        setBrainstormVisible(false);
                      }}
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: 8, 
                        background: '#111827', 
                        color: 'white', 
                        border: 'none', 
                        cursor: 'pointer', 
                        fontWeight: 600 
                      }}
                    >
                      Generate post from this prompt
                    </button>
                    <button 
                      onClick={() => setBrainstormVisible(false)} 
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: 8, 
                        background: '#0a66c2', 
                        color: 'white', 
                        border: 'none', 
                        cursor: 'pointer', 
                        fontWeight: 600 
                      }}
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <MySavedIdeas
        open={myIdeasOpen}
        onClose={() => setMyIdeasOpen(false)}
        onAfterDelete={() => void refreshSavedCount()}
        onUseInCopilot={(prompt) => {
          window.dispatchEvent(
            new CustomEvent('linkedinwriter:copilotSeedFromPrompt', { detail: { prompt } })
          );
          setMyIdeasOpen(false);
          setBrainstormVisible(false);
        }}
      />
    </>
  );
};

export default BrainstormFlow;
