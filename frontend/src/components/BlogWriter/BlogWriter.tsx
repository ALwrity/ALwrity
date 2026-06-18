import React, { useRef, useCallback, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { debug } from '../../utils/debug';
import WriterCopilotSidebar from './BlogWriterUtils/WriterCopilotSidebar';
import { blogWriterApi } from '../../services/blogWriterApi';
import { researchCache } from '../../services/researchCache';
import { useClaimFixer } from '../../hooks/useClaimFixer';
import { useMarkdownProcessor } from '../../hooks/useMarkdownProcessor';
import { useBlogWriterState } from '../../hooks/useBlogWriterState';
import HallucinationChecker from './HallucinationChecker';
import Publisher from './Publisher';
import OutlineGenerator from './OutlineGenerator';
import OutlineRefiner from './OutlineRefiner';
import { SEOProcessor } from './SEO';
import TaskProgressModals from './BlogWriterUtils/TaskProgressModals';
import { SEOAnalysisModal } from './SEOAnalysisModal';
import { SEOMetadataModal } from './SEOMetadataModal';
import { DiffPreviewModal } from './DiffPreviewModal/DiffPreviewModal';
import { usePhaseNavigation } from '../../hooks/usePhaseNavigation';
import HeaderBar from './BlogWriterUtils/HeaderBar';
import PhaseContent from './BlogWriterUtils/PhaseContent';
import useBlogWriterCopilotActions from './BlogWriterUtils/useBlogWriterCopilotActions';
import { useCopilotKitHealth } from '../../hooks/useCopilotKitHealth';
import { useSEOManager } from './BlogWriterUtils/useSEOManager';
import { usePhaseActionHandlers } from './BlogWriterUtils/usePhaseActionHandlers';
import { useBlogWriterPolling } from './BlogWriterUtils/useBlogWriterPolling';
import { useCopilotSuggestions } from './BlogWriterUtils/useCopilotSuggestions';
import { usePhaseRestoration } from './BlogWriterUtils/usePhaseRestoration';
import { useModalVisibility } from './BlogWriterUtils/useModalVisibility';
import { useBlogWriterRefs } from './BlogWriterUtils/useBlogWriterRefs';
import { BlogWriterLandingSection } from './BlogWriterUtils/BlogWriterLandingSection';
import { CopilotKitComponents } from './BlogWriterUtils/CopilotKitComponents';
import { useBlogAsset } from '../../hooks/useBlogAsset';
import { blogAssetAPI } from '../../api/blogAsset';
import { useContentPlanningStore } from '../../stores/contentPlanningStore';
import { useWorkflowStore } from '../../stores/workflowStore';

const BlogWriter: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Add light theme class to body/html on mount, remove on unmount
  React.useEffect(() => {
    document.body.classList.add('blog-writer-page');
    document.documentElement.classList.add('blog-writer-page');
    return () => {
      document.body.classList.remove('blog-writer-page');
      document.documentElement.classList.remove('blog-writer-page');
    };
  }, []);

  // Check CopilotKit health status
  const { isAvailable: copilotKitAvailable } = useCopilotKitHealth({
    enabled: true, // Enable health checking
  });

  const navigate = useNavigate();

  // Use custom hook for all state management
  const {
    research,
    outline,
    titleOptions,
    selectedTitle,
    sections,
    introduction,
    seoAnalysis,
    seoMetadata,
    continuityRefresh,
    sourceMappingStats,
    groundingInsights,
    researchCoverage,
    researchTitles,
    aiGeneratedTitles,
    outlineConfirmed,
    contentConfirmed,
    flowAnalysisCompleted,
    flowAnalysisResults,
    sectionImages,
    restoreAttempted,
    setResearch,
    setOutline,
    setTitleOptions,
    setSelectedTitle,
    setSections,
    setIntroduction,
    setSeoAnalysis,
    setSeoMetadata,
    setContinuityRefresh,
    setOutlineTaskId,
    setContentConfirmed,
    setOutlineConfirmed,
    setFlowAnalysisCompleted,
    setFlowAnalysisResults,
    setSectionImages,
    handleResearchComplete,
    handleOutlineComplete,
    handleOutlineError,
    handleTitleSelect,
    handleCustomTitle,
    handleOutlineConfirmed,
    handleOutlineRefined,
    handleContentUpdate,
    handleContentSave,
    restoreFromAsset
  } = useBlogWriterState();

  // Selected competitive advantage for outline generation — defaults to first
  const [selectedCompetitiveAdvantage, setSelectedCompetitiveAdvantage] = useState<string>('');
  const handleCompetitiveAdvantageSelect = useCallback((advantage: string) => {
    setSelectedCompetitiveAdvantage(advantage);
  }, []);

  // SEO Manager - handles all SEO-related logic
  // Initialize phase navigation with temporary false value for seoRecommendationsApplied
  const [tempSeoRecommendationsApplied] = React.useState(false);
  const {
    currentPhase: tempCurrentPhase,
    navigateToPhase: tempNavigateToPhase,
    resetUserSelection
  } = usePhaseNavigation(
    research,
    outline,
    outlineConfirmed,
    Object.keys(sections).length > 0,
    contentConfirmed,
    seoAnalysis,
    seoMetadata,
    tempSeoRecommendationsApplied
  );

  const {
    isSEOAnalysisModalOpen,
    setIsSEOAnalysisModalOpen,
    isSEOMetadataModalOpen,
    setIsSEOMetadataModalOpen,
    seoRecommendationsApplied,
    lastSEOModalOpenRef,
    runSEOAnalysisDirect,
    handleApplySeoRecommendations,
    handleSEOAnalysisComplete,
    handleSEOModalClose,
    confirmBlogContent,
    isDiffModalOpen,
    diffPreviewData,
    acceptDiffChanges,
    acceptSelectedDiffChanges,
    rejectDiffChanges,
  } = useSEOManager({
    sections,
    introduction,
    research,
    outline,
    selectedTitle,
    selectedCompetitiveAdvantage,
    contentConfirmed,
    seoAnalysis,
    currentPhase: tempCurrentPhase,
    navigateToPhase: tempNavigateToPhase,
    setContentConfirmed,
    setSeoAnalysis,
    setSeoMetadata,
    setSections,
    setSelectedTitle: setSelectedTitle as (title: string | null) => void,
    setIntroduction,
    setContinuityRefresh,
    setFlowAnalysisCompleted,
    setFlowAnalysisResults,
  });

  // Phase navigation hook with correct seoRecommendationsApplied
  const {
    phases,
    currentPhase,
    navigateToPhase,
    setCurrentPhase,
    resetUserSelection: resetUserSelection2,
  } = usePhaseNavigation(
    research,
    outline,
    outlineConfirmed,
    Object.keys(sections).length > 0,
    contentConfirmed,
    seoAnalysis,
    seoMetadata,
    seoRecommendationsApplied
  );

  // Update ref when navigateToPhase changes
  React.useEffect(() => {
    navigateToPhaseRef.current = navigateToPhase;
  }, [navigateToPhase]);

  // Phase restoration logic
  usePhaseRestoration({
    copilotKitAvailable,
    research,
    phases,
    currentPhase,
    navigateToPhase,
    setCurrentPhase,
    resetUserSelection: resetUserSelection2,
  });

  // All SEO management logic is now in useSEOManager hook above

  // Custom hooks for complex functionality
  const { buildFullMarkdown, buildUpdatedMarkdownForClaim, applyClaimFix } = useClaimFixer(
    outline,
    sections,
    setSections
  );
  
  const { convertMarkdownToHTML } = useMarkdownProcessor(
    outline,
    sections
  );

  // Store navigateToPhase in a ref for use in polling callbacks
  const navigateToPhaseRef = React.useRef<((phase: string) => void) | null>(null);
  // When true (Re-Content), polling callback skips auto-confirm and SEO navigation
  const skipContentAutoConfirmRef = React.useRef<boolean>(false);

  // Brainstorm result from GSC — passed conditionally to ResearchSources sidebar
  const [brainstormResult, setBrainstormResult] = useState<any>(null);
  const handleBrainstormResult = useCallback((result: any) => {
    setBrainstormResult(result);
  }, []);

  // Selected content angle for outline generation — defaults to first angle
  const [selectedContentAngle, setSelectedContentAngle] = useState<string>('');
  const handleAngleSelect = useCallback((angle: string) => {
    setSelectedContentAngle(angle);
  }, []);

  // Auto-select first content angle when research loads
  React.useEffect(() => {
    const angles = research?.suggested_angles;
    if (angles && angles.length > 0) {
      setSelectedContentAngle(prev => prev || angles[0]);
    }
  }, [research]);

  // Auto-select first competitive advantage when research loads
  React.useEffect(() => {
    const advantages = research?.competitor_analysis?.competitive_advantages;
    if (advantages && advantages.length > 0) {
      setSelectedCompetitiveAdvantage(prev => prev || advantages[0]);
    }
  }, [research]);

  // Lifted keywords from ManualResearchForm (for header chip "Click To Research" label)
  const [researchKeywords, setResearchKeywords] = useState<string>('');
  const researchBlogLengthRef = useRef<string>('1000');
  // Shared ref exposed by ManualResearchForm / ResearchAction for header-triggered research
  const startResearchRef = useRef<((keywords: string, blogLength?: string) => Promise<any>) | null>(null);

  // Normalize section keys to match outline IDs when updating from API responses
  const handleSectionsUpdate = useCallback((newSections: Record<string, string>) => {
    if (outline && outline.length > 0 && Object.keys(newSections).length > 0) {
      const normalized: Record<string, string> = {};
      const values = Object.values(newSections);
      outline.forEach((s, idx) => {
        const id = String(s.id);
        normalized[id] = newSections[id] ?? values[idx] ?? '';
      });
      setSections(normalized);
    } else {
      setSections(newSections);
    }
  }, [outline, setSections]);

  // Blog asset persistence (phase-by-phase saving via ContentAsset)
  const {
    assetId,
    createAsset,
    updatePhase,
    loadAsset,
    resetAsset,
    asset,
  } = useBlogAsset();
  // Load blog asset passed via React Router state (from Asset Library)
  const location = useLocation();
  const locationState = location.state as { restoreBlogAssetId?: number; calendarTopic?: string; calendarDescription?: string; calendarEventId?: string; workflowTaskId?: string } | null;

  // Persist last active asset_id across refreshes
  const saveLastAssetId = useCallback((id: number) => {
    try { localStorage.setItem('blog_last_asset_id', id.toString()); } catch { /* noop */ }
  }, []);

  React.useEffect(() => {
    const assetIdFromState = locationState?.restoreBlogAssetId;
    if (assetIdFromState) {
      // Coming from Asset Library — load that specific asset
      loadAsset(assetIdFromState).then(loaded => {
        if (!loaded) return;
        saveLastAssetId(assetIdFromState);
        restoreFromAsset(loaded);
        debug.log('[BlogWriter] Loaded blog asset from navigation state', { asset_id: assetIdFromState, phase: loaded.phase });
      });
    } else {
      // No navigation state — try restoring last active asset from localStorage
      const savedId = (() => { try { return localStorage.getItem('blog_last_asset_id'); } catch { return null; } })();
      if (savedId) {
        const id = parseInt(savedId, 10);
        if (!isNaN(id)) {
          loadAsset(id).then(loaded => {
            if (loaded) {
              restoreFromAsset(loaded);
              debug.log('[BlogWriter] Restored last active blog', { asset_id: id, phase: loaded.phase });
            } else {
              // Asset was deleted or inaccessible — clear stale localStorage key
              try { localStorage.removeItem('blog_last_asset_id'); } catch { /* noop */ }
            }
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wrap handlers to also update the blog ContentAsset
  const wrappedHandleResearchComplete = useCallback(async (researchData: any) => {
    handleResearchComplete(researchData);
    const kw = researchData?.original_keywords
      ? (Array.isArray(researchData.original_keywords) ? researchData.original_keywords.join(', ') : researchData.original_keywords)
      : (researchKeywords || '');
    const bl = researchBlogLengthRef.current || researchData?.word_count_target?.toString() || '1000';
    if (assetId) {
      // Re-Research: update existing asset
      updatePhase('research', researchData);
      saveLastAssetId(assetId);
    } else {
      // First research: create blog asset AFTER research completes
      const id = await createAsset(kw, kw, parseInt(bl));
      if (id) {
        saveLastAssetId(id);
        // Direct API call: createAsset sets React state but the closure is stale
        await blogAssetAPI.update(id, { phase: 'research', research_data: researchData });
      }
    }
  }, [handleResearchComplete, researchKeywords, assetId, createAsset, saveLastAssetId, updatePhase]);

  // Handler for header chip "Click To Research" / "Re-Research"
  const handleResearchStartAction = useCallback(async () => {
    navigateToPhase('research');
    let kw = researchKeywords;
    if (!kw && research) {
      kw = Array.isArray(research.original_keywords)
        ? research.original_keywords.join(', ')
        : research.original_keywords || '';
    }
    const bl = researchBlogLengthRef.current || (research as any)?.word_count_target?.toString() || '1000';
    if (!kw) return;
    await new Promise(resolve => setTimeout(resolve, 0));
    if (startResearchRef.current) {
      await startResearchRef.current(kw, bl);
    }
  }, [navigateToPhase, researchKeywords, research]);

  // Handler for "Run Research" button on Content Angles in ResearchSources
  const handleResearchWithKeywords = useCallback(async (keywords: string) => {
    navigateToPhase('research');
    setResearchKeywords(keywords);
    setResearch(null);
    const bl = researchBlogLengthRef.current || '1000';
    await new Promise(resolve => setTimeout(resolve, 0));
    if (startResearchRef.current) {
      await startResearchRef.current(keywords, bl);
    }
  }, [navigateToPhase, setResearchKeywords, setResearch, researchBlogLengthRef, startResearchRef]);

  const wrappedHandleSEOAnalysisComplete = useCallback((analysis: any) => {
    handleSEOAnalysisComplete(analysis);
    if (assetId) { updatePhase('seo', analysis); saveLastAssetId(assetId); }
  }, [handleSEOAnalysisComplete, assetId, updatePhase, saveLastAssetId]);

  const wrappedHandleOutlineConfirmed = useCallback(() => {
    handleOutlineConfirmed();
    if (assetId) {
      updatePhase('outline', { outline, selected_title: selectedTitle, title_options: titleOptions });
      saveLastAssetId(assetId);
    }
  }, [handleOutlineConfirmed, assetId, updatePhase, outline, selectedTitle, titleOptions, saveLastAssetId]);

  const wrappedConfirmBlogContent = useCallback(() => {
    const result = confirmBlogContent();
    if (assetId) { updatePhase('content', sections); saveLastAssetId(assetId); }
    return result;
  }, [confirmBlogContent, assetId, updatePhase, sections, saveLastAssetId]);

  // Polling hooks - extracted to useBlogWriterPolling
  const {
    researchPolling,
    outlinePolling,
    mediumPolling,
    rewritePolling,
    researchPollingState,
    outlinePollingState,
    mediumPollingState,
  } = useBlogWriterPolling({
    onResearchComplete: wrappedHandleResearchComplete,
    onOutlineComplete: handleOutlineComplete,
    onOutlineError: handleOutlineError,
    onSectionsUpdate: handleSectionsUpdate,
    onContentConfirmed: () => {
      debug.log('[BlogWriter] Content generation completed - auto-confirming content');
      setContentConfirmed(true);
    },
    onContentError: () => {
      debug.log('[BlogWriter] Content generation failed - reverting outline confirmation');
      setOutlineConfirmed(false);
    },
    navigateToPhase: (phase) => {
      debug.log('[BlogWriter] Navigating to phase after content generation', { phase });
      // Use ref to access navigateToPhase (defined later in component)
      if (navigateToPhaseRef.current) {
        setTimeout(() => {
          navigateToPhaseRef.current?.(phase);
        }, 0);
      }
    },
    skipContentAutoConfirmRef,
  });

  // Modal visibility management - extracted to useModalVisibility
  const {
    showModal,
    setShowModal,
    showOutlineModal,
    setShowOutlineModal,
    setIsMediumGenerationStarting,
  } = useModalVisibility({
    mediumPolling,
    rewritePolling,
    outlinePolling,
  });

  // CopilotKit suggestions management - extracted to useCopilotSuggestions
  // Check if sections exist AND have actual content (not just empty strings)
  const hasContent = React.useMemo(() => {
    const sectionKeys = Object.keys(sections);
    if (sectionKeys.length === 0) return false;
    // Check if at least one section has actual content
    const sectionsWithContent = Object.values(sections).filter(c => c && c.trim().length > 0);
    return sectionsWithContent.length > 0;
  }, [sections]);
  const { suggestions } = useCopilotSuggestions({
    research,
    outline,
    outlineConfirmed,
    researchPollingState,
    outlinePollingState,
    mediumPollingState,
    hasContent,
    flowAnalysisCompleted,
    contentConfirmed,
    seoAnalysis,
    seoMetadata,
    seoRecommendationsApplied,
  });

  // Refs and tracking logic - extracted to useBlogWriterRefs
  useBlogWriterRefs({
    research,
    outline,
    outlineConfirmed,
    contentConfirmed,
    sections,
    currentPhase,
    isSEOAnalysisModalOpen,
    resetUserSelection,
    restoreAttempted,
  });

  const handlePhaseClick = useCallback((phaseId: string) => {
    navigateToPhase(phaseId);
    if (phaseId === 'research') {
      if (!currentPhase) {
        setResearch(null);
        debug.log('[BlogWriter] Research phase clicked from landing - cleared research to show form');
      } else {
        debug.log('[BlogWriter] Research phase clicked - showing existing research data');
      }
    }
    if (phaseId === 'seo') {
      if (seoAnalysis) {
        setIsSEOAnalysisModalOpen(true);
        debug.log('[BlogWriter] SEO modal opened (phase navigation)');
      } else {
        runSEOAnalysisDirect();
      }
    }
  }, [navigateToPhase, currentPhase, seoAnalysis, setResearch, runSEOAnalysisDirect, setIsSEOAnalysisModalOpen]);

  const handleNewBlog = useCallback(() => {
    setResearch(null);
    setOutline([]);
    setSections({});
    setSeoAnalysis(null);
    setSeoMetadata(null);
    setContentConfirmed(false);
    setOutlineConfirmed(false);
    setSelectedTitle('');
    setTitleOptions([]);
    setCurrentPhase('');
    try {
      localStorage.removeItem('blog_outline');
      localStorage.removeItem('blog_title_options');
      localStorage.removeItem('blog_selected_title');
      localStorage.removeItem('blogwriter_current_phase');
      localStorage.removeItem('blogwriter_user_selected_phase');
      localStorage.removeItem('blog_content_confirmed');
      localStorage.removeItem('blog_seo_recommendations_applied');
      localStorage.removeItem('blog_publish_completed');
      localStorage.removeItem('blog_last_asset_id');
    } catch {
      // ignore localStorage errors
    }
    researchCache.clearCache();
    resetAsset();
    setSearchParams({}, { replace: true });
  }, [setResearch, setOutline, setSections, setSeoAnalysis, setSeoMetadata,
      setContentConfirmed, setOutlineConfirmed, setSelectedTitle, setTitleOptions,
      setCurrentPhase, resetAsset, setSearchParams]);

  // Handle ?new=true query param from "New Blog" button in Asset Library
  React.useEffect(() => {
    if (searchParams.get('new') === 'true') {
      handleNewBlog();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, handleNewBlog, setSearchParams]);

  const [newBlogDialogOpen, setNewBlogDialogOpen] = useState(false);

  const handleMyBlogs = useCallback(() => {
    navigate('/asset-library?source_module=blog_writer&asset_type=text');
  }, [navigate]);

  const hasExistingWork = !!(research || outline.length > 0 || Object.keys(sections).length > 0);

  const confirmNewBlog = useCallback(() => {
    if (hasExistingWork) {
      setNewBlogDialogOpen(true);
    } else {
      handleNewBlog();
    }
  }, [hasExistingWork, handleNewBlog]);

  const outlineGenRef = useRef<any>(null);

  // Callback to handle cached outline completion
  const handleCachedOutlineComplete = useCallback((result: { outline: any[], title_options?: string[] }) => {
    if (result.outline && Array.isArray(result.outline)) {
      handleOutlineComplete(result);
    }
  }, [handleOutlineComplete]);

  // Callback to handle cached content completion
  const handleCachedContentComplete = useCallback((cachedSections: Record<string, string>) => {
    if (cachedSections && Object.keys(cachedSections).length > 0) {
      setSections(cachedSections);
      setContentConfirmed(true);
      debug.log('[BlogWriter] Cached content loaded into state, auto-confirmed', { sections: Object.keys(cachedSections).length });
      setTimeout(() => {
        navigateToPhaseRef.current?.('seo');
      }, 0);
    }
  }, [setSections, setContentConfirmed]);

  // Phase action handlers for when CopilotKit is unavailable - extracted to usePhaseActionHandlers
  const {
    handleResearchAction,
    handleOutlineAction,
    handleOutlineStartAction,
    handleContentAction,
    handleSEOAction,
    handleApplySEORecommendations,
    handlePublishAction,
  } = usePhaseActionHandlers({
    research,
    outline,
    selectedTitle,
    contentConfirmed,
    sections,
    seoAnalysis,
    navigateToPhase,
    handleOutlineConfirmed,
    setIsMediumGenerationStarting,
    mediumPolling,
    outlineGenRef,
    setOutline,
    setContentConfirmed,
    setIsSEOAnalysisModalOpen,
    setIsSEOMetadataModalOpen,
    runSEOAnalysisDirect,
    skipContentAutoConfirmRef,
    onResearchComplete: wrappedHandleResearchComplete,
    onOutlineComplete: handleCachedOutlineComplete,
    onContentComplete: handleCachedContentComplete,
  });

  // Handle medium generation start from OutlineFeedbackForm
  const handleMediumGenerationStarted = (taskId: string) => {
    console.log('Starting medium generation polling for task:', taskId);
    setIsMediumGenerationStarting(false); // Clear the starting state
    mediumPolling.startPolling(taskId);
  };

  // Show modal immediately when copilot action is triggered
  const handleMediumGenerationTriggered = () => {
    console.log('Medium generation triggered - showing modal immediately');
    setIsMediumGenerationStarting(true);
  };

  useBlogWriterCopilotActions({
    isSEOAnalysisModalOpen,
    lastSEOModalOpenRef,
    runSEOAnalysisDirect,
    confirmBlogContent: wrappedConfirmBlogContent,
    sections,
    research,
    openSEOMetadata: () => setIsSEOMetadataModalOpen(true),
    navigateToPhase,
  });

  const handleOpenSEOMetadata = React.useCallback(() => {
    setIsSEOMetadataModalOpen(true);
  }, [setIsSEOMetadataModalOpen]);

  const handleRunFlowAnalysis = React.useCallback(async () => {
    try {
      const payload = {
        title: selectedTitle || 'Blog Post',
        sections: outline.map(s => ({
          id: s.id,
          heading: s.heading,
          content: sections[s.id] || '',
        })),
      };
      const result = await blogWriterApi.analyzeFlowBasic(payload);
      if (result.success && result.analysis) {
        setFlowAnalysisResults(result.analysis);
        setFlowAnalysisCompleted(true);
      }
    } catch (err) {
      console.error('Flow analysis failed:', err);
    }
  }, [selectedTitle, outline, sections, setFlowAnalysisResults, setFlowAnalysisCompleted]);

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      color: '#1a1a1a',
      overflow: 'auto'
    }} className="blog-writer-container">
      {/* CopilotKit-dependent components - extracted to CopilotKitComponents */}
      {copilotKitAvailable && (
        <CopilotKitComponents
          research={research}
          outline={outline}
          outlineConfirmed={outlineConfirmed}
          sections={sections}
          selectedTitle={selectedTitle}
          onResearchComplete={wrappedHandleResearchComplete}
          startResearchRef={startResearchRef}
          onOutlineCreated={setOutline}
          onOutlineUpdated={setOutline}
          onTitleOptionsSet={setTitleOptions}
          onOutlineConfirmed={wrappedHandleOutlineConfirmed}
          onOutlineRefined={(feedback?: string) => handleOutlineRefined(feedback || '')}
          onMediumGenerationStarted={handleMediumGenerationStarted}
          onMediumGenerationTriggered={handleMediumGenerationTriggered}
          onRewriteStarted={(taskId) => {
            console.log('Starting rewrite polling for task:', taskId);
            rewritePolling.startPolling(taskId);
          }}
          onRewriteTriggered={() => {
            console.log('Rewrite triggered - showing modal immediately');
            setIsMediumGenerationStarting(true);
          }}
          setFlowAnalysisCompleted={setFlowAnalysisCompleted}
          setFlowAnalysisResults={setFlowAnalysisResults}
          setContinuityRefresh={setContinuityRefresh}
          researchPolling={researchPolling}
          navigateToPhase={navigateToPhase}
          onBrainstormResult={handleBrainstormResult}
        />
      )}
      
      {/* New extracted functionality components */}
      <OutlineGenerator
        ref={outlineGenRef}
        research={research}
        onTaskStart={(taskId) => setOutlineTaskId(taskId)}
        onPollingStart={(taskId) => outlinePolling.startPolling(taskId)}
        onModalShow={() => setShowOutlineModal(true)}
        navigateToPhase={navigateToPhase}
        onOutlineCreated={(outline, titleOptions) => {
          // Handle cached outline from CopilotKit action (same as header button)
          setOutline(outline);
          if (titleOptions) {
            setTitleOptions(titleOptions);
          }
        }}
        selectedContentAngle={selectedContentAngle}
        selectedCompetitiveAdvantage={selectedCompetitiveAdvantage}
      />
      <OutlineRefiner
        outline={outline}
        onOutlineUpdated={setOutline}
      />
      <SEOProcessor
        buildFullMarkdown={buildFullMarkdown}
        seoMetadata={seoMetadata}
        onSEOAnalysis={setSeoAnalysis}
        onSEOMetadata={setSeoMetadata}
      />
      <HallucinationChecker
        buildFullMarkdown={buildFullMarkdown}
        buildUpdatedMarkdownForClaim={buildUpdatedMarkdownForClaim}
        applyClaimFix={applyClaimFix}
      />
        <Publisher
        buildFullMarkdown={buildFullMarkdown}
        convertMarkdownToHTML={convertMarkdownToHTML}
        seoMetadata={seoMetadata}
        onPublishComplete={() => {
          if (assetId) {
            const fullContent = buildFullMarkdown();
            updatePhase('publish', {
              published_at: new Date().toISOString(),
              content_preview: fullContent.substring(0, 500),
              title: selectedTitle || seoMetadata?.seo_title || '',
            });
            saveLastAssetId(assetId);
          }
          // Mark originating calendar event as published
          const eventId = locationState?.calendarEventId;
          if (eventId) {
            const { updateEvent } = useContentPlanningStore.getState();
            updateEvent(eventId, { status: 'published' }).catch((err: any) =>
              console.warn('[BlogWriter] Failed to update calendar event:', err)
            );
          }
          // Mark the workflow task as completed and navigate back
          const taskId = locationState?.workflowTaskId;
          if (taskId) {
            const { completeTask } = useWorkflowStore.getState();
            completeTask(taskId).catch((err: any) =>
              console.warn('[BlogWriter] Failed to complete workflow task:', err)
            );
            setTimeout(() => navigate('/dashboard'), 1500);
          }
        }}
      />
      
      {/* Phase navigation header - always visible as default interface */}
      <div style={{ flexShrink: 0 }}>
      <HeaderBar
        phases={phases}
        currentPhase={currentPhase}
        onPhaseClick={handlePhaseClick}
        copilotKitAvailable={copilotKitAvailable}
        actionHandlers={{
          onResearchAction: handleResearchAction,
          onResearchStartAction: handleResearchStartAction,
          onOutlineAction: handleOutlineAction,
          onOutlineStartAction: handleOutlineStartAction,
          onContentAction: handleContentAction,
          onSEOAction: handleSEOAction,
          onApplySEORecommendations: handleApplySEORecommendations,
          onPublishAction: handlePublishAction,
        }}
        researchKeywords={researchKeywords}
        hasResearch={!!research}
        hasOutline={outline.length > 0}
        outlineConfirmed={outlineConfirmed}
        hasContent={hasContent}
        contentConfirmed={contentConfirmed}
        hasSEOAnalysis={!!seoAnalysis && (seoRecommendationsApplied || !!seoMetadata)}
        seoRecommendationsApplied={seoRecommendationsApplied}
        hasSEOMetadata={!!seoMetadata}
        onNewBlog={confirmNewBlog}
        onMyBlogs={handleMyBlogs}
        onHelp={() => window.open('/docs', '_blank')}
      />
      </div>

      {/* Landing section - extracted to BlogWriterLandingSection */}
      <BlogWriterLandingSection
        research={research}
        copilotKitAvailable={copilotKitAvailable}
        currentPhase={currentPhase}
        navigateToPhase={navigateToPhase}
        onResearchComplete={wrappedHandleResearchComplete}
        onKeywordsChange={setResearchKeywords}
        blogLengthRef={researchBlogLengthRef}
        startResearchRef={startResearchRef}
        restoreAttempted={restoreAttempted}
        onBrainstormResult={handleBrainstormResult}
      />

      {research && (
        <>
      <PhaseContent
        currentPhase={currentPhase}
        research={research}
        outline={outline}
        outlineConfirmed={outlineConfirmed}
        titleOptions={titleOptions}
        selectedTitle={selectedTitle}
        researchTitles={researchTitles}
        aiGeneratedTitles={aiGeneratedTitles}
        sourceMappingStats={sourceMappingStats}
        groundingInsights={groundingInsights}
        researchCoverage={researchCoverage}
        setOutline={setOutline}
        sections={sections}
        introduction={introduction}
        onIntroductionUpdate={setIntroduction}
        handleContentUpdate={handleContentUpdate}
        handleContentSave={handleContentSave}
        continuityRefresh={continuityRefresh}
        flowAnalysisResults={flowAnalysisResults}
        outlineGenRef={outlineGenRef}
        blogWriterApi={blogWriterApi}
        sectionImages={sectionImages}
        setSectionImages={setSectionImages}
        contentConfirmed={contentConfirmed}
        seoAnalysis={seoAnalysis}
        seoMetadata={seoMetadata}
        onTitleSelect={handleTitleSelect}
        onCustomTitle={handleCustomTitle}
        copilotKitAvailable={copilotKitAvailable}
        onResearchComplete={wrappedHandleResearchComplete}
        onKeywordsChange={setResearchKeywords}
        blogLengthRef={researchBlogLengthRef}
        startResearchRef={startResearchRef}
        onOutlineGenerationStart={(taskId) => {
          setOutlineTaskId(taskId);
          outlinePolling.startPolling(taskId);
          setShowOutlineModal(true);
        }}
        onContentGenerationStart={handleMediumGenerationStarted}
        buildFullMarkdown={buildFullMarkdown}
        convertMarkdownToHTML={convertMarkdownToHTML}
        brainstormResult={brainstormResult}
        onBrainstormResult={handleBrainstormResult}
        onResearchWithKeywords={handleResearchWithKeywords}
        selectedContentAngle={selectedContentAngle}
        onAngleSelect={handleAngleSelect}
        selectedCompetitiveAdvantage={selectedCompetitiveAdvantage}
        onCompetitiveAdvantageSelect={handleCompetitiveAdvantageSelect}
        onOpenSEOMetadata={handleOpenSEOMetadata}
        onRunFlowAnalysis={handleRunFlowAnalysis}
      />
        </>
      )}

      <WriterCopilotSidebar
        suggestions={suggestions}
        research={research}
        outline={outline}
        outlineConfirmed={outlineConfirmed}
      />
      
      <TaskProgressModals
        showOutlineModal={showOutlineModal}
        outlinePolling={outlinePolling}
        showModal={showModal}
        rewritePolling={rewritePolling}
        mediumPolling={mediumPolling}
        onCloseOutlineModal={() => setShowOutlineModal(false)}
        onCloseContentModal={() => setShowModal(false)}
      />

      {/* SEO Analysis Modal */}
      <SEOAnalysisModal
        isOpen={isSEOAnalysisModalOpen}
        onClose={handleSEOModalClose}
        blogContent={buildFullMarkdown()}
        blogTitle={selectedTitle}
        researchData={research}
        outline={outline}
        competitiveAdvantage={selectedCompetitiveAdvantage}
        onApplyRecommendations={handleApplySeoRecommendations}
        onAnalysisComplete={wrappedHandleSEOAnalysisComplete}
      />

      {/* Diff Preview Modal */}
      <DiffPreviewModal
        isOpen={isDiffModalOpen}
        diffData={diffPreviewData}
        onAccept={acceptDiffChanges}
        onAcceptSelected={acceptSelectedDiffChanges}
        onReject={rejectDiffChanges}
      />

      {/* SEO Metadata Modal */}
      <SEOMetadataModal
        isOpen={isSEOMetadataModalOpen}
        onClose={() => setIsSEOMetadataModalOpen(false)}
        blogContent={buildFullMarkdown()}
        blogTitle={selectedTitle}
        researchData={research}
        outline={outline}
        seoAnalysis={seoAnalysis}
        sectionImages={sectionImages}
        onMetadataGenerated={(metadata) => {
          console.log('SEO metadata generated:', metadata);
          setSeoMetadata(metadata);
        }}
      />

      {/* New Blog confirmation dialog */}
      <Dialog
        open={newBlogDialogOpen}
        onClose={() => setNewBlogDialogOpen(false)}
        aria-labelledby="new-blog-dialog-title"
      >
        <DialogTitle id="new-blog-dialog-title">Start New Blog?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will clear all your current work and start a new blog. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewBlogDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => { handleNewBlog(); setNewBlogDialogOpen(false); }} color="primary" variant="contained">
            Start New
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default BlogWriter;