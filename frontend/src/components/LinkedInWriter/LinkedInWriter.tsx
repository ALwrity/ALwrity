import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Snackbar, Alert, CircularProgress } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { linkedInWriterApi } from '../../services/linkedInWriterApi';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import './styles/alwrity-copilot.css';
import RegisterLinkedInActions from './RegisterLinkedInActions';
import RegisterLinkedInEditActions from './RegisterLinkedInEditActions';
import RegisterLinkedInActionsEnhanced from './RegisterLinkedInActionsEnhanced';
import {
  Header,
  ContentEditor,
  LoadingIndicator,
  WelcomeMessage,
  ProgressTracker,
  GrowthEnginePanel,
  PostAnalyticsPanel,
  PeopleYouMayKnowTabPanel,
  LinkedInWriterTabBar,
  type ProgressStep,
  type LinkedInWriterTab,
} from './components';
import OutlineEditor from './components/OutlineEditor';
import PublishLinkedInPanel from './components/PublishLinkedInPanel';
import { useCopilotActions } from './components/CopilotActions';
import { useLinkedInWriter } from './hooks/useLinkedInWriter';
import { useCopilotPersistence } from './utils/enhancedPersistence';
import { PlatformPersonaProvider, usePlatformPersonaContext } from '../shared/PersonaContext/PlatformPersonaProvider';
import { saveLinkedInToAssetLibrary } from '../../services/linkedInWriterApi';
import { useCopilotActionTyped } from '../../hooks/useCopilotActionTyped';

// Optional debug flag: set to true to enable verbose logs locally
// const DEBUG_LINKEDIN = false;

const observabilityHooks = {
  onChatExpanded: () => {
    console.log('[LinkedIn Writer] Sidebar opened');
  },
  onMessageSent: (message: any) => {
    const text = typeof message === 'string' ? message : (message?.content ?? '');
    if (text) {
      console.log('[LinkedIn Writer] User message tracked:', { content_length: text.length });
    }
  },
  onFeedbackGiven: (id: string, type: string) => {
    console.log('[LinkedIn Writer] Feedback given:', { id, type });
  }
};

interface LinkedInWriterProps {
  className?: string;
}

const LinkedInWriter: React.FC<LinkedInWriterProps> = ({ className = '' }) => {
  return (
    <PlatformPersonaProvider platform="linkedin">
      <LinkedInWriterContent className={className} />
    </PlatformPersonaProvider>
  );
};

// Main LinkedIn Writer Content Component
const LinkedInWriterContent: React.FC<LinkedInWriterProps> = ({ className = '' }) => {
  const {
    // State
    draft,
    context,
    isGenerating,
    isPreviewing,
    livePreviewHtml,
    pendingEdit,
    loadingMessage,
    currentAction,
    chatHistory,
    userPreferences,
    // currentSuggestions,
    showPreferencesModal,
    // showContextModal,
    showPreview,
    justGeneratedContent,
    
    // Grounding data
    researchSources,
    citations,
    qualityMetrics,
    groundingEnabled,
    searchQueries,
    progressSteps,
    progressActive,
    
    // Setters
    setDraft,
    setChatHistory,
    setIsPreviewing,
    setLivePreviewHtml,
    setPendingEdit,
    setUserPreferences,
    setShowPreferencesModal,
    // setShowContextModal,
    setShowPreview,
    
    // Handlers
    handleDraftChange,
    handleContextChange,
    handleClear,
    // handleCopy,
    handleClearHistory,
    
    // Utilities
    getHistoryLength,
    savePreferences,
    summarizeHistory,
    
    // Direct generation methods
    generatePost,
    generateArticle,
    generateCarousel,
    generateVideoScript,

    // Outline state (Phase 2)
    outlineSections,
    outlineTitleSuggestions,
    outlineMode,
    setOutlineMode,
    isGeneratingOutline,
    generateOutline,
    refineOutline,
  } = useLinkedInWriter();

  // Get persona context for enhanced AI assistance
  const { corePersona, platformPersona } = usePlatformPersonaContext();
  // const { corePersona, platformPersona, loading: personaLoading } = usePlatformPersonaContext();

  // Get enhanced persistence functionality
  const {
    // persistenceManager,
    // saveChatHistory,
    loadChatHistory,
    // addChatMessage,
    saveUserPreferences: savePersistedPreferences,
    loadUserPreferences: loadPersistedPreferences,
    // saveConversationContext,
    loadConversationContext,
    saveDraftContent,
    loadDraftContent,
    saveLastSession,
    loadLastSession,
    getStorageStats
  } = useCopilotPersistence();
  
  // Save-to-asset-library state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Read calendar topic from navigation state (e.g. from Calendar tab)
  const location = useLocation();
  const locationState = location.state as {
    calendarTopic?: string;
    calendarDescription?: string;
    calendarEventId?: string;
    workflowTaskId?: string;
    linkedinDraftContent?: string;
    linkedinDraftAssetId?: number;
  } | null;

  useEffect(() => {
    document.title = 'LinkedIn Studio | ALwrity';
    return () => {
      document.title = 'ALwrity — AI Digital Marketing Operating System';
    };
  }, []);

  // Pre-fill context from calendar event on mount
  useEffect(() => {
    const topic = locationState?.calendarTopic;
    if (topic) {
      const description = locationState?.calendarDescription || '';
      const contextText = `Topic: ${topic}${description ? `\nDescription: ${description}` : ''}`;
      handleContextChange(contextText);
      // Clear navigation state so refresh doesn't re-trigger
      window.history.replaceState({}, document.title);
    }

    const draftContent = locationState?.linkedinDraftContent;
    if (draftContent) {
      setDraft(draftContent);
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab navigation ──
  const [activeTab, setActiveTab] = useState<LinkedInWriterTab>('editor');

  useEffect(() => {
    const onSwitchTab = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: LinkedInWriterTab }>).detail?.tab;
      if (tab === 'editor' || tab === 'growth' || tab === 'pymk' || tab === 'analytics') {
        setActiveTab(tab);
      }
    };
    window.addEventListener('linkedinwriter:switchTab', onSwitchTab);
    return () => window.removeEventListener('linkedinwriter:switchTab', onSwitchTab);
  }, []);

  // ── Outline → Article handler ──
  const handleGenerateArticleFromOutline = useCallback(async () => {
    await generateArticle();
    setOutlineMode(false);
  }, [generateArticle, setOutlineMode]);

  // ── Generate similar post handler ──
  const handleGenerateSimilarPost = useCallback((prompt: string) => {
    // Switch to editor tab and set context
    setActiveTab('editor');
    handleContextChange(prompt);
    // Optionally trigger generation immediately or let user review
  }, [handleContextChange]);

  // ── Share a Link (Quick Post from URL) ──
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState('');
  const [shareLinkTone, setShareLinkTone] = useState('professional');
  const [shareLinkMyTake, setShareLinkMyTake] = useState('');
  const [shareLinkGenerating, setShareLinkGenerating] = useState(false);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setShareLinkUrl('');
      setShareLinkMyTake('');
      setShareLinkError(null);
      setShowShareLinkModal(true);
    };
    window.addEventListener('linkedinwriter:openShareLink', onOpen);
    return () => window.removeEventListener('linkedinwriter:openShareLink', onOpen);
  }, []);

  const handleGenerateFromUrl = async () => {
    const url = shareLinkUrl.trim();
    if (!url) return;
    setShareLinkGenerating(true);
    setShareLinkError(null);
    try {
      const result = await linkedInWriterApi.generateFromUrl({
        url,
        tone: shareLinkTone,
        my_take: shareLinkMyTake.trim() || undefined,
      });
      if (result?.success && result?.data?.content) {
        setShowShareLinkModal(false);
        window.dispatchEvent(
          new CustomEvent('linkedinwriter:updateDraft', { detail: { content: result.data.content } })
        );
      } else {
        setShareLinkError(result?.error || 'Generation failed');
      }
    } catch (err: any) {
      setShareLinkError(err?.response?.data?.detail || err?.message || 'Failed to generate from URL');
    } finally {
      setShareLinkGenerating(false);
    }
  };

  // ── Save to Asset Library (podcast-maker pattern: save only, stay on page) ──
  
  const handleSaveToAssetLibrary = async () => {
    if (!draft) return;
    setSaveStatus('saving');
    setSaveErrorMessage(null);
    try {
      const topic = context?.startsWith('Topic:') 
        ? context.replace(/^Topic:\s*/, '').split('\n')[0].trim()
        : undefined;
      const title = draft.split('\n')[0].substring(0, 100) || 'LinkedIn Post';

      const result = await saveLinkedInToAssetLibrary({
        title,
        content: draft,
        topic,
        tags: ['linkedin_post', 'social_media'],
        assetMetadata: {
          word_count: draft.split(/\s+/).length,
          source: locationState?.calendarTopic ? 'calendar' : 'manual',
        },
      });

      console.log('[LinkedInWriter] Saved to Asset Library, assetId:', result.assetId);

      setSaveStatus('saved');

    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'Please try again.';
      console.error('[LinkedInWriter] Save failed:', err);
      setSaveErrorMessage(message);
      setSaveStatus('error');
    }
  };

  // Sync component state with enhanced persistence
  useEffect(() => {
    console.log('[LinkedIn Writer] Component mounted, enhanced persistence enabled');
    
    // Load persisted data on component mount
    const loadPersistedData = () => {
      try {
        // Load chat history
        const persistedChatHistory = loadChatHistory();
        if (persistedChatHistory.length > 0) {
          setChatHistory(persistedChatHistory.map(m => ({
            role: m.role,
            content: m.content,
            ts: m.timestamp || Date.now(),
            action: m.metadata?.action,
            result: m.metadata?.result
          })));
          console.log(`📖 Restored ${persistedChatHistory.length} persisted chat messages`);
        }
        
        // Load user preferences
        const persistedPrefs = loadPersistedPreferences();
        if (persistedPrefs) {
          setUserPreferences(persistedPrefs);
          console.log('📖 Restored persisted user preferences');
        }
        
        // Load conversation context (for future use)
        const conversationContext = loadConversationContext();
        console.log('📖 Loaded persisted conversation context:', conversationContext);
        
        // Load draft content
        const persistedDraft = loadDraftContent();
        if (persistedDraft && !draft) {
          setDraft(persistedDraft);
          console.log('📖 Restored persisted draft content');
        }
        
        // Load last session
        const lastSession = loadLastSession();
        if (lastSession) {
          console.log('📖 Last session:', lastSession);
        }
        
        // Get storage statistics
        const stats = getStorageStats();
        console.log('📊 Persistence stats:', stats);
        
      } catch (error) {
        console.error('❌ Error loading persisted data:', error);
      }
    };
    
    // Load data after a short delay to allow CopilotKit to initialize
    setTimeout(loadPersistedData, 1000);
    
    // Save session data when component unmounts
    return () => {
      saveLastSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle preview changes
  const handleConfirmChanges = () => {
    if (pendingEdit) {
      setDraft(pendingEdit.target);
    }
    setIsPreviewing(false);
    setPendingEdit(null);
    setLivePreviewHtml('');
  };

  const handleDiscardChanges = () => {
    setIsPreviewing(false);
    setPendingEdit(null);
    setLivePreviewHtml('');
  };

  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
  };

  const handlePreferencesChange = (prefs: Partial<typeof userPreferences>) => {
    const updated = { ...userPreferences, ...prefs };
    setUserPreferences(updated);
    savePreferences(prefs);
    
    // Also save to enhanced persistence
    savePersistedPreferences(prefs);
  };

  // Auto-save draft content when it changes
  useEffect(() => {
    if (draft && draft.trim().length > 0) {
      saveDraftContent(draft);
    }
  }, [draft, saveDraftContent]);

  // Allow Copilot to update the draft directly
  useCopilotActionTyped({
    name: 'updateLinkedInDraft',
    description: 'Replace the LinkedIn content draft with provided content',
    parameters: [
      { name: 'content', type: 'string', description: 'The full content to set', required: true }
    ],
    handler: async ({ content }: { content: string }) => {
      setDraft(content);
      return { success: true, message: 'Draft updated' };
    }
  });

  // Let Copilot append text to the draft
  useCopilotActionTyped({
    name: 'appendToLinkedInDraft',
    description: 'Append text to the current LinkedIn content draft',
    parameters: [
      { name: 'content', type: 'string', description: 'The text to append', required: true }
    ],
    handler: async ({ content }: { content: string }) => {
      setDraft(prev => (prev ? `${prev}\n\n${content}` : content));
      return { success: true, message: 'Text appended' };
    }
  });


  // Use the CopilotActions hook to handle all copilot-related functionality
  const getIntelligentSuggestions = useCopilotActions({
    draft,
    context,
    userPreferences,
    justGeneratedContent,
    handleContextChange,
    setDraft
  });

  const labels = useMemo(() => ({
    title: 'ALwrity Co-Pilot',
    initial: draft
      ? 'Great! I can see you have content to work with. Use the quick edit suggestions below to refine your post in real-time, or ask me to make specific changes.'
      : `Hi! I'm your ALwrity Co-Pilot, your LinkedIn writing assistant${corePersona ? ` with ${corePersona.persona_name} persona optimization` : ''}. I can help you create professional posts, articles, carousels, video scripts, and comment responses. Try the new persona-aware actions for enhanced content generation!`
  }), [draft, corePersona]);

  const makeSystemMessage = useCallback((context: string, additional?: string) => {
    const prefs = userPreferences;
    const prefsLine = Object.keys(prefs).length ? `User preferences (remember and respect unless changed): ${JSON.stringify(prefs)}` : '';
    const history = summarizeHistory();
    const historyLine = history ? `Recent conversation (last 15 messages):\n${history}` : '';
    const currentDraft = draft ? `Current draft content:\n${draft}` : 'No current draft content.';
    const tone = prefs.tone || 'professional';
    const industry = prefs.industry || 'Technology';
    const audience = prefs.target_audience || 'professionals';
    
    const personaGuidance = corePersona && platformPersona ? `
PERSONA-AWARE WRITING GUIDANCE:
- PERSONA: ${corePersona.persona_name} (${corePersona.archetype})
- CORE BELIEF: ${corePersona.core_belief}
- CONFIDENCE SCORE: ${corePersona.confidence_score}%
- LINGUISTIC STYLE: ${corePersona.linguistic_fingerprint?.sentence_metrics?.average_sentence_length_words || 'Unknown'} words average, ${corePersona.linguistic_fingerprint?.sentence_metrics?.active_to_passive_ratio || 'Unknown'} active/passive ratio
- GO-TO WORDS: ${corePersona.linguistic_fingerprint?.lexical_features?.go_to_words?.join(', ') || 'None specified'}
- AVOID WORDS: ${corePersona.linguistic_fingerprint?.lexical_features?.avoid_words?.join(', ') || 'None specified'}

PLATFORM OPTIMIZATION (LinkedIn):
- CHARACTER LIMIT: ${platformPersona.content_format_rules?.character_limit || '3000'} characters
- OPTIMAL LENGTH: ${platformPersona.content_format_rules?.optimal_length || '150-300 words'}
- ENGAGEMENT PATTERN: ${platformPersona.engagement_patterns?.posting_frequency || '2-3 times per week'}
- HASHTAG STRATEGY: ${platformPersona.lexical_features?.hashtag_strategy || '3-5 relevant hashtags'}

ALWAYS generate content that matches this persona's linguistic fingerprint and platform optimization rules.` : '';

    const guidance = `
You are ALwrity's LinkedIn Writing Assistant specializing in ${industry} content.

CRITICAL CONSTRAINTS:
- TONE: Always maintain a ${tone} tone throughout all content
- INDUSTRY: Focus specifically on ${industry} industry context and terminology
- AUDIENCE: Target content specifically for ${audience}
- QUALITY: Ensure all content meets LinkedIn professional standards
${personaGuidance ? `\n${personaGuidance}` : ''}

CURRENT CONTEXT:
${currentDraft}

    Available LinkedIn content tools:
   - generateLinkedInPost: Create ${tone} LinkedIn posts for ${industry} ${audience}
   - generateLinkedInArticle: Write ${tone} thought leadership articles about ${industry}
   - generateLinkedInCarousel: Design ${tone} multi-slide carousels for ${industry} insights
   - generateLinkedInVideoScript: Create ${tone} video scripts for ${industry} topics
   - generateLinkedInCommentResponse: Draft ${tone} responses appropriate for ${industry}
   
   🎭 ENHANCED PERSONA-AWARE ACTIONS (Recommended):
   - generateLinkedInPostWithPersona: Create posts optimized for your writing style and platform constraints
   - generateLinkedInArticleWithPersona: Write articles with persona-aware optimization
   - validateContentAgainstPersona: Validate existing content against your persona
   - getPersonaWritingSuggestions: Get personalized writing recommendations

DIRECT DRAFT ACTIONS:
- updateLinkedInDraft: Replace the entire draft with new content
- appendToLinkedInDraft: Add text to the existing draft
- editLinkedInDraft: Apply quick edits (Casual, Professional, TightenHook, AddCTA, Shorten, Lengthen) to the current draft

IMPORTANT: When refining or editing content, always reference the current draft above. If the user asks to refine their post, use the current draft content as the starting point. Never ask for content that already exists in the draft.

For quick edits, use editLinkedInDraft with the appropriate operation. This will show a live preview of changes before applying them.

Use user preferences, context, conversation history, and persona data to personalize all content.
Always respect the user's preferred ${tone} tone, ${industry} industry focus, and writing persona style.
Always use the most appropriate tool for the user's request.`.trim();
    return [prefsLine, historyLine, currentDraft, guidance, additional].filter(Boolean).join('\n\n');
  }, [draft, userPreferences, corePersona, platformPersona, summarizeHistory]);

  return (
    <div 
      className={`linkedin-writer ${className}`} 
      style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#ffffff' // White professional background
      }}
    >
      {/* Header */}
      <Header
        userPreferences={userPreferences}
        chatHistory={chatHistory}
        showPreferencesModal={showPreferencesModal}
        onPreferencesModalChange={setShowPreferencesModal}
        onPreferencesChange={handlePreferencesChange}
        hasDraft={!!draft}
        onResetDraft={handleClear}
        generatePost={generatePost}
      />

      <LinkedInWriterTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', overflowY: 'auto' }}>
          {/* Content Area */}
        {activeTab === 'growth' ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <GrowthEnginePanel generatePost={generatePost} userPreferences={userPreferences} />
          </div>
        ) : activeTab === 'pymk' ? (
          <PeopleYouMayKnowTabPanel />
        ) : activeTab === 'analytics' ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <PostAnalyticsPanel
              isActive={activeTab === 'analytics'}
              onGenerateSimilarPost={handleGenerateSimilarPost}
            />
          </div>
        ) : draft || isGenerating ? (<>
          {draft && !isGenerating && (
            <div style={{ 
              padding: '8px 24px', 
              display: 'flex', 
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <Button
                type="button"
                variant="contained"
                onClick={() => setDraft('')}
                startIcon={<span style={{ fontSize: 18, lineHeight: 1 }}>←</span>}
                sx={{ 
                  fontWeight: 700,
                  bgcolor: '#0a66c2', 
                  '&:hover': { bgcolor: '#004182' },
                  textTransform: 'none',
                  fontSize: 14,
                  px: 2.5,
                  py: 1,
                  boxShadow: '0 2px 8px rgba(10, 102, 194, 0.3)',
                }}
              >
                Back to Dashboard
              </Button>

              <Button
                type='button'
                variant="outlined"
                color="primary"
                startIcon={saveStatus === 'saving' ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                onClick={handleSaveToAssetLibrary}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                sx={{ textTransform: 'none', fontSize: 13, fontWeight: 600 }}
              >
                {saveStatus === 'saving' ? 'Saving...' : 
                 saveStatus === 'saved' ? 'Saved ✓' : 
                 'Save to Asset Library'}
              </Button>

              <div style={{ flex: 1 }} />

              <PublishLinkedInPanel draft={draft} compact />
            </div>
          )}

          <ContentEditor
            isPreviewing={isPreviewing}
            pendingEdit={pendingEdit}
            livePreviewHtml={livePreviewHtml}
            draft={draft}
            showPreview={showPreview}
            isGenerating={isGenerating}
            loadingMessage={loadingMessage}
            // Grounding data
            researchSources={researchSources}
            citations={citations}
            qualityMetrics={qualityMetrics}
            groundingEnabled={groundingEnabled}
            searchQueries={searchQueries}
            onConfirmChanges={handleConfirmChanges}
            onDiscardChanges={handleDiscardChanges}
            onDraftChange={handleDraftChange}
            onPreviewToggle={handlePreviewToggle}
            topic={context ? context.split('\n')[0].substring(0, 50) : undefined}
          />
        </>) : (
          /* Outline Editor - Show when planning sections */
          outlineMode && outlineSections.length > 0 ? (
            <OutlineEditor
              outline={outlineSections}
              titleSuggestions={outlineTitleSuggestions}
              onRefine={refineOutline}
              onGenerateArticle={handleGenerateArticleFromOutline}
              onBack={() => setOutlineMode(false)}
              isGenerating={isGenerating}
            />
          ) : (
          /* Welcome Message - Show when no content */
          <WelcomeMessage
            draft={draft}
            isGenerating={isGenerating}
            onGeneratePost={generatePost}
            onGenerateArticle={generateArticle}
            onGenerateCarousel={generateCarousel}
            onGenerateVideoScript={generateVideoScript}
            onGenerateOutline={generateOutline}
            outlineMode={outlineMode}
            userPreferences={userPreferences}
          />)
        )}
      </div>

      {/* Save feedback snackbar */}
      <Snackbar
        open={saveStatus === 'saved' || saveStatus === 'error'}
        autoHideDuration={6000}
        onClose={() => { setSaveStatus('idle'); setSaveErrorMessage(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={saveStatus === 'saved' ? 'success' : 'error'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {saveStatus === 'saved'
            ? 'LinkedIn post saved to Asset Library!'
            : `Failed to save: ${saveErrorMessage || 'Please try again.'}`}
        </Alert>
      </Snackbar>

      {/* ── Share a Link Modal ── */}
      {showShareLinkModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          }}
          onClick={() => setShowShareLinkModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', width: 520, maxWidth: '92vw', borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px', background: 'linear-gradient(135deg, #0a66c2 0%, #125ea2 100%)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 16 }}>🔗 Share a Link</span>
              <button
                onClick={() => setShowShareLinkModal(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>URL *</div>
                <input
                  value={shareLinkUrl}
                  onChange={(e) => setShareLinkUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tone</div>
                  <select
                    value={shareLinkTone}
                    onChange={(e) => setShareLinkTone(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                      fontSize: 14, background: 'white',
                    }}
                  >
                    <option value="professional">Professional</option>
                    <option value="conversational">Conversational</option>
                    <option value="authoritative">Authoritative</option>
                    <option value="inspirational">Inspirational</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Your Take <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
                </div>
                <textarea
                  value={shareLinkMyTake}
                  onChange={(e) => setShareLinkMyTake(e.target.value)}
                  placeholder="Add your perspective, opinion, or key insight..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>
              {shareLinkError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>
                  {shareLinkError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => setShowShareLinkModal(false)}
                  style={{
                    padding: '10px 20px', background: '#fff', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateFromUrl}
                  disabled={!shareLinkUrl.trim() || shareLinkGenerating}
                  style={{
                    padding: '10px 20px',
                    background: !shareLinkUrl.trim() || shareLinkGenerating ? '#93c5fd' : '#0a66c2',
                    color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  {shareLinkGenerating ? 'Generating...' : 'Generate Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register CopilotKit Actions */}
      <RegisterLinkedInActions />
      <RegisterLinkedInEditActions />
      {/* Enhanced Persona-Aware Actions */}
      <RegisterLinkedInActionsEnhanced />


      {/* CopilotKit Sidebar */}
      <CopilotSidebar 
        className="alwrity-copilot-sidebar linkedin-writer"
        labels={labels}
        suggestions={getIntelligentSuggestions}
        makeSystemMessage={makeSystemMessage}
        observabilityHooks={observabilityHooks}
      />

      {/* Progress overlay — renders as fixed-position modal via portal */}
      <ProgressTracker steps={progressSteps as ProgressStep[]} active={progressActive} />
    </div>
  );
};

export default LinkedInWriter;
