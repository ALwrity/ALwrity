import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  loadHistory, 
  clearHistory, 
  getHistoryLength, 
  getPreferences, 
  savePreferences, 
  getCurrentContext, 
  saveCurrentContext, 
  summarizeHistory,
  type ChatMsg,
  type LinkedInPreferences
} from '../utils/storageUtils';
import { getContextAwareSuggestions, mapPostType, mapTone, mapIndustry, mapSearchEngine, readPrefs } from '../utils/linkedInWriterUtils';
import { linkedInWriterApi, GroundingLevel } from '../../../services/linkedInWriterApi';
import { CopilotPersistenceManager } from '../utils/enhancedPersistence';

export function useLinkedInWriter() {
  // Core state
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [livePreviewHtml, setLivePreviewHtml] = useState('');
  const [pendingEdit, setPendingEdit] = useState<{ src: string; target: string } | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  
  // Grounding data state
  const [researchSources, setResearchSources] = useState<any[]>([]);
  const [citations, setCitations] = useState<any[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<any>(null);
  const [groundingEnabled, setGroundingEnabled] = useState(false);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);

  // Progress state (lightweight custom system)
  type ProgressStatus = 'pending' | 'active' | 'completed' | 'error';
  type ProgressStep = { 
    id: string; 
    label: string; 
    status: ProgressStatus; 
    message?: string;
    details?: any;
    timestamp?: string;
  };
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [progressActive, setProgressActive] = useState<boolean>(false);

  // Chat history state
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [userPreferences, setUserPreferences] = useState<LinkedInPreferences>(getPreferences());
  
  // UI state
  const currentSuggestions = useMemo(() => getContextAwareSuggestions(
    userPreferences,
    draft,
    chatHistory.slice(-5),
    userPreferences.last_used_actions || []
  ), [userPreferences, draft, chatHistory]);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [justGeneratedContent, setJustGeneratedContent] = useState(false);

  // Track action usage and update preferences
  const trackActionUsage = useCallback((actionName: string) => {
    const currentPrefs = getPreferences();
    const updatedActions = [...(currentPrefs.last_used_actions || []), actionName].slice(-5);
    savePreferences({ last_used_actions: updatedActions });
    setUserPreferences(prev => ({ ...prev, last_used_actions: updatedActions }));
    
    // Mark content as just generated for content creation actions
    if (['generateLinkedInPost', 'generateLinkedInArticle', 'generateLinkedInCarousel', 'generateLinkedInVideoScript'].includes(actionName)) {
      setJustGeneratedContent(true);
      // Reset the flag after 30 seconds
      setTimeout(() => setJustGeneratedContent(false), 30000);
    }
  }, []);

  // ── Direct generation methods (UI-driven, no CopilotKit dependency) ──────────
  const generatePost = useCallback(async (params?: any) => {
    const prefs = readPrefs();
    window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', { 
      detail: { action: 'generateLinkedInPost', message: 'Researching and writing your LinkedIn post...' } 
    }));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
      steps: [
        { id: 'personalize', label: 'Analyzing topic & audience' },
        { id: 'prepare_queries', label: 'Preparing research strategy' },
        { id: 'research', label: 'Gathering industry insights' },
        { id: 'grounding', label: 'Grounding in research data' },
        { id: 'content_generation', label: 'Writing LinkedIn post' },
        { id: 'citations', label: 'Attaching source citations' },
        { id: 'quality_analysis', label: 'Running quality checks' },
        { id: 'finalize', label: 'Final polish' }
      ]
    }}));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { 
      detail: { id: 'personalize', status: 'active', message: 'Analyzing topic, industry, and target audience — tailoring the content for LinkedIn engagement...' } 
    }));

    // Simulate progress advancement during API call
    const progressStepIds = ['personalize', 'prepare_queries', 'research', 'grounding', 'content_generation', 'citations', 'quality_analysis'];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressStepIds.length) {
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
          detail: { id: progressStepIds[stepIndex], status: 'completed' }
        }));
        stepIndex++;
      }
    }, 1500);

    try {
      const res = await linkedInWriterApi.generatePost({
        topic: params?.topic || prefs.topic || 'AI transformation in business',
        industry: mapIndustry(params?.industry || prefs.industry),
        post_type: mapPostType(params?.post_type || prefs.post_type),
        tone: mapTone(params?.tone || prefs.tone),
        target_audience: params?.target_audience || prefs.target_audience || 'Business leaders and professionals',
        key_points: params?.key_points || prefs.key_points || [],
        include_hashtags: params?.include_hashtags ?? (prefs.include_hashtags ?? true),
        include_call_to_action: params?.include_call_to_action ?? (prefs.include_call_to_action ?? true),
        research_enabled: params?.research_enabled ?? (prefs.research_enabled ?? true),
        search_engine: mapSearchEngine(params?.search_engine || prefs.search_engine),
        max_length: params?.max_length || prefs.max_length || 2000,
        grounding_level: 'enhanced' as GroundingLevel,
        include_citations: true
      });
      clearInterval(progressInterval);
      if (res.success && res.data) {
        // Catch up remaining steps
        while (stepIndex < progressStepIds.length) {
          window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
            detail: { id: progressStepIds[stepIndex], status: 'completed' }
          }));
          stepIndex++;
        }
        const content = res.data.content;
        const hashtags = res.data.hashtags?.map((h: any) => h.hashtag).join(' ') || '';
        const cta = res.data.call_to_action || '';
        let fullContent = content;
        if (hashtags) fullContent += `\n\n${hashtags}`;
        if (cta) fullContent += `\n\n${cta}`;
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateGroundingData', { detail: {
          researchSources: res.research_sources || [],
          citations: res.data?.citations || [],
          qualityMetrics: res.data?.quality_metrics || null,
          groundingEnabled: res.data?.grounding_enabled || false,
          searchQueries: res.data?.search_queries || []
        }}));
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: fullContent }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { detail: { id: 'finalize', status: 'completed', message: 'Post optimized for LinkedIn engagement' } }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
        trackActionUsage('generateLinkedInPost');
        return { success: true, data: res.data };
      }
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, error: res.error || 'Generation failed' };
    } catch (error: any) {
      clearInterval(progressInterval);
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: error.message } }));
      return { success: false, error: error.message || 'Generation failed' };
    }
  }, []);

  const generateArticle = useCallback(async (params?: any) => {
    const prefs = readPrefs();
    window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', {
      detail: { action: 'generateLinkedInArticle', message: 'Researching and writing your LinkedIn article...' }
    }));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
      steps: [
        { id: 'personalize', label: 'Analyzing topic & audience' },
        { id: 'prepare_queries', label: 'Preparing research strategy' },
        { id: 'research', label: 'Gathering industry insights' },
        { id: 'grounding', label: 'Grounding in research data' },
        { id: 'content_generation', label: 'Writing article content' },
        { id: 'citations', label: 'Attaching source citations' },
        { id: 'quality_analysis', label: 'Running quality checks' },
        { id: 'finalize', label: 'Final polish' }
      ]
    }}));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
      detail: { id: 'personalize', status: 'active', message: 'Analyzing topic, industry, and target audience — tailoring the content for LinkedIn engagement...' }
    }));

    const progressStepIds = ['personalize', 'prepare_queries', 'research', 'grounding', 'content_generation', 'citations', 'quality_analysis'];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressStepIds.length) {
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
          detail: { id: progressStepIds[stepIndex], status: 'completed' }
        }));
        stepIndex++;
      }
    }, 1500);

    try {
      const res = await linkedInWriterApi.generateArticle({
        topic: params?.topic || prefs.topic || 'Digital transformation strategies',
        industry: mapIndustry(params?.industry || prefs.industry),
        tone: mapTone(params?.tone || prefs.tone),
        target_audience: params?.target_audience || prefs.target_audience || 'Industry professionals and executives',
        key_sections: params?.key_sections || prefs.key_sections || [],
        include_images: params?.include_images ?? (prefs.include_images ?? true),
        seo_optimization: params?.seo_optimization ?? (prefs.seo_optimization ?? true),
        research_enabled: params?.research_enabled ?? (prefs.research_enabled ?? true),
        search_engine: mapSearchEngine(params?.search_engine || prefs.search_engine),
        word_count: params?.word_count || prefs.word_count || 1500,
        grounding_level: 'enhanced' as GroundingLevel,
        include_citations: true
      });
      clearInterval(progressInterval);
      if (res.success && res.data) {
        while (stepIndex < progressStepIds.length) {
          window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
            detail: { id: progressStepIds[stepIndex], status: 'completed' }
          }));
          stepIndex++;
        }
        const content = `# ${res.data.title}\n\n${res.data.content}`;
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateGroundingData', { detail: {
          researchSources: res.research_sources || [],
          citations: res.data?.citations || [],
          qualityMetrics: res.data?.quality_metrics || null,
          groundingEnabled: res.data?.grounding_enabled || false,
          searchQueries: res.data?.search_queries || []
        }}));
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: content }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { detail: { id: 'finalize', status: 'completed', message: 'Article formatted for LinkedIn publishing' } }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
        trackActionUsage('generateLinkedInArticle');
        return { success: true, data: res.data };
      }
      clearInterval(progressInterval);
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, error: res.error || 'Generation failed' };
    } catch (error: any) {
      clearInterval(progressInterval);
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: error.message } }));
      return { success: false, error: error.message || 'Generation failed' };
    }
  }, []);

  const generateCarousel = useCallback(async (params?: any) => {
    const prefs = readPrefs();
    window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', {
      detail: { action: 'generateLinkedInCarousel', message: 'Researching and building your LinkedIn carousel...' }
    }));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
      steps: [
        { id: 'personalize', label: 'Analyzing topic & audience' },
        { id: 'prepare_queries', label: 'Preparing research strategy' },
        { id: 'research', label: 'Gathering industry insights' },
        { id: 'grounding', label: 'Grounding in research data' },
        { id: 'content_generation', label: 'Building carousel slides' },
        { id: 'citations', label: 'Attaching source citations' },
        { id: 'quality_analysis', label: 'Running quality checks' },
        { id: 'finalize', label: 'Final polish' }
      ]
    }}));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
      detail: { id: 'personalize', status: 'active', message: 'Analyzing topic, industry, and target audience — tailoring the content for LinkedIn engagement...' }
    }));

    const progressStepIds = ['personalize', 'prepare_queries', 'research', 'grounding', 'content_generation', 'citations', 'quality_analysis'];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressStepIds.length) {
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
          detail: { id: progressStepIds[stepIndex], status: 'completed' }
        }));
        stepIndex++;
      }
    }, 1500);

    try {
      const res = await linkedInWriterApi.generateCarousel({
        topic: params?.topic || prefs.topic || 'Professional development tips',
        industry: mapIndustry(params?.industry || prefs.industry),
        number_of_slides: params?.number_of_slides || prefs.number_of_slides || 8,
        tone: mapTone(params?.tone || prefs.tone),
        target_audience: params?.target_audience || prefs.target_audience || 'Professionals seeking growth',
        key_takeaways: params?.key_takeaways || prefs.key_takeaways || [],
        include_cover_slide: params?.include_cover_slide ?? (prefs.include_cover_slide ?? true),
        include_cta_slide: params?.include_cta_slide ?? (prefs.include_cta_slide ?? true),
        visual_style: params?.visual_style || prefs.visual_style || 'modern'
      });
      clearInterval(progressInterval);
      if (res.success && res.data) {
        while (stepIndex < progressStepIds.length) {
          window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
            detail: { id: progressStepIds[stepIndex], status: 'completed' }
          }));
          stepIndex++;
        }
        let content = `# ${res.data.title}\n\n`;
        res.data.slides.forEach((slide: any, index: number) => {
          content += `## Slide ${index + 1}: ${slide.title}\n\n${slide.content}\n\n`;
        });
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: content }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { detail: { id: 'finalize', status: 'completed', message: 'Carousel optimized for mobile viewing' } }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
        trackActionUsage('generateLinkedInCarousel');
        return { success: true, data: res.data };
      }
      clearInterval(progressInterval);
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, error: res.error || 'Generation failed' };
    } catch (error: any) {
      clearInterval(progressInterval);
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: error.message } }));
      return { success: false, error: error.message || 'Generation failed' };
    }
  }, []);

  const generateVideoScript = useCallback(async (params?: any) => {
    const prefs = readPrefs();
    window.dispatchEvent(new CustomEvent('linkedinwriter:loadingStart', {
      detail: { action: 'generateLinkedInVideoScript', message: 'Researching and writing your video script...' }
    }));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressInit', { detail: {
      steps: [
        { id: 'personalize', label: 'Analyzing topic & audience' },
        { id: 'prepare_queries', label: 'Preparing research strategy' },
        { id: 'research', label: 'Gathering industry insights' },
        { id: 'grounding', label: 'Grounding in research data' },
        { id: 'content_generation', label: 'Writing video script' },
        { id: 'citations', label: 'Attaching source citations' },
        { id: 'quality_analysis', label: 'Running quality checks' },
        { id: 'finalize', label: 'Final polish' }
      ]
    }}));
    window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
      detail: { id: 'personalize', status: 'active', message: 'Analyzing topic, industry, and target audience — tailoring the content for LinkedIn engagement...' }
    }));

    const progressStepIds = ['personalize', 'prepare_queries', 'research', 'grounding', 'content_generation', 'citations', 'quality_analysis'];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressStepIds.length) {
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
          detail: { id: progressStepIds[stepIndex], status: 'completed' }
        }));
        stepIndex++;
      }
    }, 1500);

    try {
      const res = await linkedInWriterApi.generateVideoScript({
        topic: params?.topic || prefs.topic || 'Professional networking tips',
        industry: mapIndustry(params?.industry || prefs.industry),
        video_length: params?.video_length || prefs.video_length || 60,
        tone: mapTone(params?.tone || prefs.tone),
        target_audience: params?.target_audience || prefs.target_audience || 'Professional networkers',
        key_messages: params?.key_messages || prefs.key_messages || [],
        include_hook: params?.include_hook ?? (prefs.include_hook ?? true),
        include_captions: params?.include_captions ?? (prefs.include_captions ?? true)
      });
      clearInterval(progressInterval);
      if (res.success && res.data) {
        while (stepIndex < progressStepIds.length) {
          window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', {
            detail: { id: progressStepIds[stepIndex], status: 'completed' }
          }));
          stepIndex++;
        }
        let content = `# Video Script: ${params?.topic || 'Professional Content'}\n\n`;
        content += `## Hook\n${res.data.hook}\n\n`;
        content += `## Main Content\n`;
        res.data.main_content.forEach((scene: any, index: number) => {
          content += `### Scene ${index + 1} (${scene.duration || '30s'})\n${scene.content}\n\n`;
        });
        content += `## Conclusion\n${res.data.conclusion}\n\n`;
        content += `## Video Description\n${res.data.video_description}\n\n`;
        if (res.data.captions) {
          content += `## Captions\n${res.data.captions.join('\n')}\n\n`;
        }
        window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: content }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressStep', { detail: { id: 'finalize', status: 'completed', message: 'Script ready for production' } }));
        window.dispatchEvent(new CustomEvent('linkedinwriter:progressComplete'));
        window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
        trackActionUsage('generateLinkedInVideoScript');
        return { success: true, data: res.data };
      }
      clearInterval(progressInterval);
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: res.error } }));
      return { success: false, error: res.error || 'Generation failed' };
    } catch (error: any) {
      clearInterval(progressInterval);
      window.dispatchEvent(new CustomEvent('linkedinwriter:loadingEnd'));
      window.dispatchEvent(new CustomEvent('linkedinwriter:progressError', { detail: { id: 'finalize', details: error.message } }));
      return { success: false, error: error.message || 'Generation failed' };
    }
  }, []);

  // Initialize chat history, preferences, and grounding data from localStorage
  useEffect(() => {
    const loadInitialData = () => {
      try {
        const history = loadHistory();
        const prefs = getPreferences();
        const savedContext = getCurrentContext();
        
        setChatHistory(history);
        setUserPreferences(prefs);
        if (savedContext && !context) {
          setContext(savedContext);
        }

        // Load persisted grounding data
        const persistence = CopilotPersistenceManager.getInstance();
        const groundingData = persistence.loadGroundingData();
        if (groundingData.researchSources.length > 0) {
          setResearchSources(groundingData.researchSources);
          setCitations(groundingData.citations);
          setQualityMetrics(groundingData.qualityMetrics);
          setGroundingEnabled(groundingData.groundingEnabled);
          setSearchQueries(groundingData.searchQueries);
        }
        
        console.log('[LinkedIn Writer] Initialized with:', {
          historyCount: history.length,
          preferences: prefs,
          hasContext: !!savedContext,
          hasGroundingData: groundingData.researchSources.length > 0
        });
      } catch (error) {
        console.warn('[LinkedIn Writer] Failed to initialize from localStorage:', error);
      }
    };

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for lightweight progress events
  useEffect(() => {
    const handleProgressInit = (event: CustomEvent) => {
      const steps: Array<{ id: string; label: string; message?: string }> = event.detail?.steps || [];
      const initialized: ProgressStep[] = steps.map((s, index) => ({
        id: s.id,
        label: s.label,
        message: s.message,
        status: index === 0 ? 'active' : 'pending',
        timestamp: new Date().toISOString()
      }));
      setProgressSteps(initialized);
      setProgressActive(true);
    };

    const handleProgressStep = (event: CustomEvent) => {
      const { id, status, details, message } = event.detail || {};
      if (!id) return;
      setProgressSteps(prev => {
        const updated = prev.map(step => step.id === id ? { 
          ...step, 
          status: (status || 'completed') as ProgressStatus, 
          details, 
          message,
          timestamp: new Date().toISOString() 
        } : step);
        // Mark next pending as active if current completed
        if ((status || 'completed') === 'completed') {
          const nextIdx = updated.findIndex(s => s.status === 'pending');
          if (nextIdx !== -1) {
            updated[nextIdx] = { 
              ...updated[nextIdx], 
              status: 'active', 
              timestamp: new Date().toISOString() 
            };
          }
        }
        return updated;
      });
    };

    const handleProgressComplete = () => {
      console.log('[LinkedIn Writer] Progress completed - hiding progress tracker');
      setProgressSteps(prev => prev.map(s => s.status === 'completed' ? s : { ...s, status: 'completed', timestamp: new Date().toISOString() }));
      setProgressActive(false);
      // Keep progress visible for a moment to show completion, then hide
      setTimeout(() => {
        console.log('[LinkedIn Writer] Hiding progress steps after delay');
        setProgressSteps([]);
      }, 1500);
    };

    const handleProgressError = (event: CustomEvent) => {
      const { id, details } = event.detail || {};
      setProgressSteps(prev => prev.map(s => (id ? (s.id === id) : (s.status === 'active')) ? { ...s, status: 'error', details, timestamp: new Date().toISOString() } : s));
      setProgressActive(false);
    };

    window.addEventListener('linkedinwriter:progressInit', handleProgressInit as EventListener);
    window.addEventListener('linkedinwriter:progressStep', handleProgressStep as EventListener);
    window.addEventListener('linkedinwriter:progressComplete', handleProgressComplete as EventListener);
    window.addEventListener('linkedinwriter:progressError', handleProgressError as EventListener);

    return () => {
      window.removeEventListener('linkedinwriter:progressInit', handleProgressInit as EventListener);
      window.removeEventListener('linkedinwriter:progressStep', handleProgressStep as EventListener);
      window.removeEventListener('linkedinwriter:progressComplete', handleProgressComplete as EventListener);
      window.removeEventListener('linkedinwriter:progressError', handleProgressError as EventListener);
    };
  }, []);

  // Listen for grounding data updates from CopilotKit actions
  useEffect(() => {
    const handleGroundingDataUpdate = (event: CustomEvent) => {
      const { researchSources, citations, qualityMetrics, groundingEnabled, searchQueries } = event.detail;
      
      setResearchSources(researchSources || []);
      setCitations(citations || []);
      setQualityMetrics(qualityMetrics || null);
      setGroundingEnabled(groundingEnabled || false);
      setSearchQueries(searchQueries || []);
      
      // Persist grounding data so it survives page refresh
      const persistence = CopilotPersistenceManager.getInstance();
      persistence.saveGroundingData({
        researchSources: researchSources || [],
        citations: citations || [],
        qualityMetrics: qualityMetrics || null,
        groundingEnabled: groundingEnabled || false,
        searchQueries: searchQueries || []
      });
    };

    window.addEventListener('linkedinwriter:updateGroundingData', handleGroundingDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('linkedinwriter:updateGroundingData', handleGroundingDataUpdate as EventListener);
    };
  }, []);

  // Save context changes to localStorage
  useEffect(() => {
    if (context) {
      saveCurrentContext(context);
    }
  }, [context]);
  
  // Handle draft updates from CopilotKit actions
  useEffect(() => {
    const handleUpdateDraft = (event: CustomEvent) => {
      console.log('[LinkedIn Writer] Draft updated:', event.detail?.substring(0, 100) + '...');
      console.log('[LinkedIn Writer] Draft length:', event.detail?.length);
      console.log('[LinkedIn Writer] Setting draft and clearing loading state...');
      setDraft(event.detail);
      setIsGenerating(false);
      setLoadingMessage('');
      setCurrentAction(null);
      // Auto-show preview when new content is generated
      setShowPreview(true);
      // Progress is finalized by the progressStep/progressComplete events dispatched after this
      console.log('[LinkedIn Writer] Draft update complete');
    };

    const handleAppendDraft = (event: CustomEvent) => {
      setDraft(prev => prev + event.detail);
    };

    const handleAssistantMessage = (event: CustomEvent) => {
      console.log('LinkedIn Assistant:', event.detail);
    };

    const handleLoadingStart = (event: CustomEvent) => {
      const { action, message } = event.detail;
      console.log('[LinkedIn Writer] Loading started:', { action, message });
      setCurrentAction(action);
      setLoadingMessage(message);
      setIsGenerating(true);
    };

    const handleLoadingEnd = (event: CustomEvent) => {
      console.log('[LinkedIn Writer] Loading ended - clearing all loading states');
      setIsGenerating(false);
      setLoadingMessage('');
      setCurrentAction(null);
      console.log('[LinkedIn Writer] Loading state cleared');
    };

    const handleApplyEdit = (event: CustomEvent) => {
      const target: string = typeof event.detail === 'string' ? event.detail : (event.detail?.target ?? '');
      const src = draft || '';
      if (!target) return;
      setPendingEdit({ src, target });
      setIsPreviewing(true);
      
      // Use diff highlighting for professional content changes
      try {
        const { diffMarkup } = require('../utils/contentFormatters');
        setLivePreviewHtml(diffMarkup(src, target));
      } catch (error) {
        // Fallback to simple text if diffMarkup fails to load
        console.warn('Failed to load diffMarkup, using fallback:', error);
        setLivePreviewHtml(target);
      }
    };

    window.addEventListener('linkedinwriter:updateDraft', handleUpdateDraft as EventListener);
    window.addEventListener('linkedinwriter:appendDraft', handleAppendDraft as EventListener);
    window.addEventListener('linkedinwriter:assistantMessage', handleAssistantMessage as EventListener);
    window.addEventListener('linkedinwriter:applyEdit', handleApplyEdit as EventListener);
    window.addEventListener('linkedinwriter:loadingStart', handleLoadingStart as EventListener);
    window.addEventListener('linkedinwriter:loadingEnd', handleLoadingEnd as EventListener);

    return () => {
      window.removeEventListener('linkedinwriter:updateDraft', handleUpdateDraft as EventListener);
      window.removeEventListener('linkedinwriter:appendDraft', handleAppendDraft as EventListener);
      window.removeEventListener('linkedinwriter:assistantMessage', handleAssistantMessage as EventListener);
      window.removeEventListener('linkedinwriter:applyEdit', handleApplyEdit as EventListener);
      window.removeEventListener('linkedinwriter:loadingStart', handleLoadingStart as EventListener);
      window.removeEventListener('linkedinwriter:loadingEnd', handleLoadingEnd as EventListener);
    };
  }, [draft]);

  // Event handlers
  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
  }, []);

  const handleContextChange = useCallback((value: string) => {
    setContext(value);
  }, []);

  const handleClear = useCallback(() => {
    setDraft('');
    setContext('');
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draft);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, [draft]);

  const handleClearHistory = useCallback(() => {
    clearHistory(); 
    setHistoryVersion(v => v + 1);
    setChatHistory([]);
    console.log('[LinkedIn Writer] Chat memory cleared by user');
  }, []);

  return {
    // State
    draft,
    context,
    isGenerating,
    isPreviewing,
    livePreviewHtml,
    pendingEdit,
    loadingMessage,
    currentAction,
    historyVersion,
    chatHistory,
    userPreferences,
    currentSuggestions,
    showContextPanel,
    showPreferencesModal,
    showContextModal,
    showPreview,
    justGeneratedContent,
    
    // Setters
    setDraft,
    setContext,
    setIsGenerating,
    setIsPreviewing,
    setLivePreviewHtml,
    setPendingEdit,
    setLoadingMessage,
    setCurrentAction,
    setHistoryVersion,
    setChatHistory,
    setUserPreferences,
    setShowContextPanel,
    setShowPreferencesModal,
    setShowContextModal,
    setShowPreview,
    setJustGeneratedContent: setJustGeneratedContent,
    
    // Handlers
    handleDraftChange,
    handleContextChange,
    handleClear,
    handleCopy,
    handleClearHistory,
    
    // Utilities
    trackActionUsage,
    getHistoryLength,
    savePreferences,
    summarizeHistory,
    
    // Direct generation methods
    generatePost,
    generateArticle,
    generateCarousel,
    generateVideoScript,
    
    // Grounding data
    researchSources,
    citations,
    qualityMetrics,
    groundingEnabled,
    searchQueries,
    setResearchSources,
    setCitations,
    setQualityMetrics,
    setGroundingEnabled,
    setSearchQueries,

    // Progress (exposed to UI)
    progressSteps,
    progressActive
  };
}
