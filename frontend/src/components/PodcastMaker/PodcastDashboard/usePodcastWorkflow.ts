import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { podcastApi } from "../../../services/podcastApi";
import { usePreflightCheck } from "../../../hooks/usePreflightCheck";
import { useBudgetTracking } from "../../../hooks/useBudgetTracking";
import { CreateProjectPayload, Script } from "../types";
import { usePodcastProjectState } from "../../../hooks/usePodcastProjectState";
import { sanitizeExaConfig, announceError, getStepLabel } from "./utils";
import { clearSceneMediaCache, clearMediaCache } from "../../../utils/mediaCache";

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

type PodcastProjectStateReturn = ReturnType<typeof usePodcastProjectState>;

interface UsePodcastWorkflowProps {
  projectState: PodcastProjectStateReturn;
  onError: (message: string) => void;
}

export const usePodcastWorkflow = ({ projectState, onError }: UsePodcastWorkflowProps) => {
  const {
    project,
    analysis,
    queries,
    selectedQueries,
    research,
    rawResearch,
    researchProvider,
    showScriptEditor,
    showRenderQueue,
    currentStep,
    renderJobs,
    budgetCap,
    setProject,
    setAnalysis,
    setQueries,
    setSelectedQueries,
    setResearch,
    setRawResearch,
    setEstimate,
    setScriptData,
    setShowScriptEditor,
    setShowRenderQueue,
    setKnobs,
    setResearchProvider,
    setBudgetCap,
    updateRenderJob,
    setRenderJobs,
    initializeProject,
    setBible,
    setBackendProjectCreated,
  } = projectState;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [announcementSeverity, setAnnouncementSeverity] = useState<"info" | "error" | "success">("info");
  const [showResumeAlert, setShowResumeAlert] = useState(false);
  const [showPreflightDialog, setShowPreflightDialog] = useState(false);
  const [preflightResponse, setPreflightResponse] = useState<any>(null);
  const [preflightOperationName, setPreflightOperationName] = useState<string>("");
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateProjectInfo, setDuplicateProjectInfo] = useState<{projectId: string; idea: string}>({ projectId: "", idea: "" });
  
  // Script Generation Modal State
  const [showScriptGenModal, setShowScriptGenModal] = useState(false);
  const [scriptGenStarted, setScriptGenStarted] = useState(false);
  const [scriptGenProgressIndex, setScriptGenProgressIndex] = useState(0);

  const budgetTracking = useBudgetTracking(budgetCap || 50);
  const preflightCheck = usePreflightCheck({
    onBlocked: (response) => {
      setPreflightResponse(response);
      setShowPreflightDialog(true);
    },
  });

  // Update budget cap when project state changes
  useEffect(() => {
    if (budgetCap) {
      budgetTracking.setBudgetCap(budgetCap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetCap]);

  // Check if we have a saved project on mount
  useEffect(() => {
    if (project && currentStep && currentStep !== "create") {
      setShowResumeAlert(true);
      setTimeout(() => setShowResumeAlert(false), 5000);
    }
  }, [project, currentStep]);

  useEffect(() => {
    if (announcement) {
      const t = setTimeout(() => setAnnouncement(""), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [announcement]);

  const prevIsGeneratingScriptRef = useRef(false);
  
  // Sequential progress for script generation modal
  useEffect(() => {
    if (!showScriptGenModal || !scriptGenStarted) {
      setScriptGenProgressIndex(0);
      return;
    }
    
    const interval = setInterval(() => {
      setScriptGenProgressIndex((prev) => {
        if (prev < 3) { // 4 steps total (0-3)
          return prev + 1;
        }
        return prev;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [showScriptGenModal, scriptGenStarted]);

  // Handle modal close when script generation completes
  useEffect(() => {
    const wasSubmitting = prevIsGeneratingScriptRef.current;
    const nowNotSubmitting = !isGeneratingScript;
    
    // Only close modal if:
    // 1. Modal is still shown
    // 2. scriptGenStarted is true  
    // 3. isGeneratingScript transitioned from true to false
    // 4. AND we're not showing an error (scriptData is set on success)
    if (showScriptGenModal && scriptGenStarted && wasSubmitting && nowNotSubmitting && !announcement.includes("failed")) {
      setTimeout(() => {
        setShowScriptGenModal(false);
      }, 500);
    }
    
    // Update ref for next render
    prevIsGeneratingScriptRef.current = isGeneratingScript;
  }, [isGeneratingScript, showScriptGenModal, scriptGenStarted, announcement]);

  const handleCreate = useCallback(async (payload: CreateProjectPayload, feedback?: string) => {
    if (isAnalyzing) return;
    setResearch(null);
    setRawResearch(null);
    setScriptData(null);
    setShowScriptEditor(false);
    setShowRenderQueue(false);
    try {
      setIsAnalyzing(true);
      
      // Use existing avatar URL if provided (e.g. brand avatar), or upload new file
      let avatarUrl: string | null = payload.avatarUrl || null;
      if (payload.files.avatarFile) {
        try {
          setAnnouncement("Uploading presenter avatar...");
          const uploadResponse = await podcastApi.uploadAvatar(payload.files.avatarFile);
          avatarUrl = uploadResponse.avatar_url;
        } catch (error) {
          console.error('Avatar upload failed:', error);
          // Continue without avatar - will generate one later
        }
      }
      
      // NEW FLOW: Create project first to generate/get the Podcast Bible
      // This allows the analysis to be personalized using the Bible context
      const projectId = project?.id || `podcast_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      setAnnouncement("Initializing project and brand context...");
      
      let dbProject: any = null;
      try {
        if (project) {
          // Existing project - mark as DB-created (it was loaded from DB)
          setBackendProjectCreated(true);
          dbProject = null;
        } else {
          dbProject = await initializeProject(payload, projectId, avatarUrl);
        }
      } catch (initError: any) {
        setBackendProjectCreated(false);
        const errorStr = initError?.message || initError?.toString() || "";
        if (errorStr.includes("DUPLICATE_IDEA") || errorStr.includes("existing_project_id") || errorStr.includes("409")) {
          setAnnouncement("");
          // Parse error message to extract existing project info
          // Format: "DUPLICATE_IDEA:podcast_123:Some idea..." or the full error response
          let existingId = "";
          let existingIdea = "";
          
          // Try extracting from "DUPLICATE_IDEA:projectid:idea" format
          if (errorStr.includes("DUPLICATE_IDEA:")) {
            const parts = errorStr.split("DUPLICATE_IDEA:")[1];
            if (parts) {
              const colonIdx = parts.indexOf(":");
              if (colonIdx > 0) {
                existingId = parts.substring(0, colonIdx).trim();
                existingIdea = parts.substring(colonIdx + 1).trim();
              }
            }
          }
          
          // If still empty, try regex on full error response
          if (!existingId) {
            const idMatch = errorStr.match(/project_id["']?\s*[:=]\s*["']?([^"'$,\s]+)/);
            existingId = idMatch ? idMatch[1].trim() : "";
          }
          if (!existingIdea) {
            const ideaMatch = errorStr.match(/idea["']?\s*[:=]\s*["']([^"']+)["']/);
            existingIdea = ideaMatch ? ideaMatch[1].trim() : "Similar project already exists";
          }
          
          console.error("[handleCreate] Duplicate project found:", existingId, existingIdea);
          // Set the dialog info and show the dialog
          setShowDuplicateDialog(true);
          setDuplicateProjectInfo({ 
            projectId: existingId || "unknown", 
            idea: existingIdea || "Similar project already exists" 
          });
          return;
        }
        // Re-throw other errors to be handled by the outer catch
        throw initError;
      }
      
      const bible = dbProject?.bible || projectState.bible;

      setAnnouncement(feedback ? "Regenerating analysis using your feedback..." : "Analyzing your idea — AI suggestions incoming");
      const result = await podcastApi.createProject(payload, bible, feedback);
      
      if (result.bible) {
        setBible(result.bible);
      } else if (dbProject?.bible) {
        setBible(dbProject.bible);
      }
      
      const effectivePresenterRef = payload.presenterReferenceUrl || result.presenterReferenceUrl || dbProject?.presenter_reference_url || null;
      const effectiveAvatarUrl = payload.avatarUrl || effectivePresenterRef || result.avatar_url || null;

      // Update the project in database with the analysis results
      // If dbProject exists, update it. Otherwise use localStorage fallback
      if (dbProject) {
        try {
          await podcastApi.updateProject(projectId, {
            analysis: result.analysis,
            estimate: result.estimate,
            queries: result.queries,
            selected_queries: [],
            avatar_url: effectiveAvatarUrl,
            avatar_prompt: result.avatar_prompt,
            presenter_reference_url: effectivePresenterRef,
          });
          setBackendProjectCreated(true);
          console.log("[handleCreate] DB project created and updated successfully");
        } catch (updateErr) {
          console.warn("[handleCreate] updateProject failed, using localStorage fallback:", updateErr);
          // Fall back to localStorage only
        }
      } else {
        // DB not created (initializeProject failed or returned null) - use localStorage only
        console.warn("[handleCreate] DB project not created - using localStorage only");
      }

      // Mark as created in local state so sync doesn't try to create later
      setBackendProjectCreated(true);

      setProject({ 
        id: projectId, 
        idea: payload.ideaOrUrl, 
        duration: payload.duration, 
        speakers: payload.speakers, 
        podcastMode: payload.podcastMode,
        avatarUrl: effectiveAvatarUrl,
        avatarPrompt: result.avatar_prompt || null,
        avatarPersonaId: null,
        presenterReferenceUrl: effectivePresenterRef,
      });
      
      setAnalysis(result.analysis);
      setEstimate(result.estimate);
      setQueries(result.queries);
      setSelectedQueries(new Set()); // Start with none selected - user must choose manually
      setKnobs(payload.knobs);
      setBudgetCap(payload.budgetCap);
      
      // Generate presenters AFTER analysis completes only if no avatar/reference exists
      if (payload.podcastMode !== "audio_only" && !avatarUrl && !effectivePresenterRef && !result.avatar_url && payload.speakers > 0 && result.analysis) {
        try {
          setAnnouncement("Generating presenter avatars using AI insights...");
          const presentersResponse = await podcastApi.generatePresenters(
            payload.speakers,
            result.projectId,
            result.analysis.audience,
            result.analysis.contentType,
            result.analysis.topKeywords
          );
          if (presentersResponse.avatars && presentersResponse.avatars.length > 0) {
            // Store the first presenter avatar URL and prompt
            const firstAvatar = presentersResponse.avatars[0];
            const prompt = firstAvatar.prompt || null;
            setProject({ 
              id: result.projectId, 
              idea: payload.ideaOrUrl, 
              duration: payload.duration, 
              speakers: payload.speakers, 
              podcastMode: payload.podcastMode,
              avatarUrl: firstAvatar.avatar_url,
              avatarPrompt: prompt,
              avatarPersonaId: firstAvatar.persona_id || presentersResponse.persona_id || null,
              presenterReferenceUrl: effectivePresenterRef,
            });
            setAnnouncement("Analysis complete - Presenter avatars generated");
          }
        } catch (error) {
          console.error('Presenter generation failed:', error);
          setAnnouncement("Analysis complete - Avatar generation will happen later");
          // Continue without presenters - can generate later
        }
      } else {
        const audioOnlyNote = payload.podcastMode === "audio_only" ? " (audio-only mode)" : "";
        setAnnouncement(`Analysis complete${audioOnlyNote}`);
      }
    } catch (error: any) {
      // Handle duplicate idea error
      const errorMessage = error?.message || String(error);
      if (errorMessage.startsWith("DUPLICATE_IDEA:")) {
        const parts = errorMessage.split(":");
        const existingId = parts[1] || "";
        const existingIdea = parts.slice(2).join(":") || "existing project";
        setAnnouncement("");
        setShowDuplicateDialog(true);
        setDuplicateProjectInfo({ projectId: existingId, idea: existingIdea });
        return;
      }
      
      if (error?.response?.status === 429 || error?.response?.data?.detail) {
        const errorDetail = error.response.data.detail;
        if (typeof errorDetail === 'object' && errorDetail.error && errorDetail.error.includes('limit')) {
          const usageInfo = errorDetail.usage_info || {};
          const blockedResponse = {
            can_proceed: false,
            estimated_cost: 0,
            operations: [{
              provider: errorDetail.provider || 'huggingface',
              operation_type: 'ai_text_generation',
              cost: 0,
              allowed: false,
              limit_info: usageInfo.limit_info || null,
              message: errorDetail.message || errorDetail.error || 'Subscription limit exceeded',
            }],
            total_cost: 0,
            usage_summary: usageInfo.usage_summary || null,
            cached: false,
          };
          setPreflightResponse(blockedResponse);
          setPreflightOperationName('Podcast Analysis');
          setShowPreflightDialog(true);
          setAnnouncement("Subscription limit reached. Please upgrade to continue.");
        } else {
          const message = typeof errorDetail === 'string' ? errorDetail : errorDetail.message || errorDetail.error || 'Request limit exceeded';
          announceError(setAnnouncement, setAnnouncementSeverityFn, new Error(message));
        }
      } else {
        announceError(setAnnouncement, setAnnouncementSeverityFn, error);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, setResearch, setRawResearch, setScriptData, setShowScriptEditor, setShowRenderQueue, initializeProject, setProject, setAnalysis, setEstimate, setQueries, setSelectedQueries, setKnobs, setBudgetCap, setBible]);

  const handleRunResearch = useCallback(async () => {
    if (isResearching) return;
    if (!project) {
      setAnnouncement("Create a project first.");
      return;
    }
    if (selectedQueries.size === 0) {
      setAnnouncement("Select at least one query to research.");
      return;
    }

    // Note: Preflight is handled inside podcastApi.runExaResearch (ensurePreflight)
    // No need to call it twice here
    
    const approvedQueries = queries.filter((q) => selectedQueries.has(q.id));
    console.log('[Research] User selected queries:', Array.from(selectedQueries));
    console.log('[Research] Filtered approvedQueries for API:', approvedQueries.map(q => q.query));

    try {
      setIsResearching(true);
      setAnnouncement(`Starting ${researchProvider === "exa" ? "deep" : "standard"} research — this may take a moment...`);
      setResearch(null);
      setRawResearch(null);
      setScriptData(null);
      setShowScriptEditor(false);
      setShowRenderQueue(false);

      try {
        console.log('[Research] Starting research with:', { topic: project.idea, approvedQueries, provider: researchProvider });
        console.log('[Research] Calling podcastApi.runResearch...');
        const { research: mapped, raw, estimate } = await podcastApi.runResearch({
          projectId: project.id,
          topic: project.idea,
          approvedQueries,
          provider: researchProvider,
          exaConfig: sanitizeExaConfig(analysis?.exaSuggestedConfig),
          bible: projectState.bible,
          analysis: analysis,
          onProgress: (message) => {
            setAnnouncement(message);
          },
        });
        console.log('[Research] Response received:', { mapped, raw });
        setResearch(mapped);
        setRawResearch(raw);
        if (estimate) {
          setEstimate(estimate);
        }
        setAnnouncement("Research complete — review fact cards below");
      } catch (researchError) {
        const errorMessage = researchError instanceof Error
          ? researchError.message
          : "Research failed. Please try again or switch to Standard Research.";

        console.error('[Research] Error caught:', researchError);
        if (errorMessage.includes("Exa") || errorMessage.includes("exa")) {
          setAnnouncement(`Deep research failed: ${errorMessage}. Try Standard Research instead.`);
        } else if (errorMessage.includes("timeout")) {
          setAnnouncement("Research timed out. Please try again with fewer queries.");
        } else {
          setAnnouncement(`Research failed: ${errorMessage}`);
        }

        console.error("Research error:", researchError);
        throw researchError;
      }
    } catch (error) {
      announceError(setAnnouncement, setAnnouncementSeverityFn, error);
    } finally {
      setIsResearching(false);
    }
  }, [isResearching, project, selectedQueries, queries, researchProvider, analysis, setResearch, setRawResearch, setEstimate, setScriptData, setShowScriptEditor, setShowRenderQueue, projectState.bible]);

// Add a ref to track if we're currently generating to prevent double calls
  const isGeneratingRef = useRef(false);
  
  const handleGenerateScript = useCallback(async () => {
    // CRITICAL: Guard against double calls - set IMMEDIATELY to prevent concurrent clicks
    if (isGeneratingRef.current || isGeneratingScript) {
      console.log('[ScriptGen] Already generating, skipping duplicate call');
      return;
    }
    
    // Prevent if script already exists or render phase started
    if (showScriptEditor || projectState.scriptData) {
      console.log('[ScriptGen] Script already exists, skipping');
      return;
    }
    
    if (!project || !research) {
      setAnnouncement("Project or research missing — cannot generate script");
      return;
    }

    // Mark as generating immediately BEFORE any async calls (both ref and state)
    isGeneratingRef.current = true;
    setIsGeneratingScript(true);
    
    // Show modal IMMEDIATELY to prevent duplicate clicks
    setShowScriptGenModal(true);
    setScriptGenStarted(true);
    setScriptGenProgressIndex(0);
    console.log('[ScriptGen] Modal shown, generating ref set');

    // Note: Preflight is also called inside podcastApi.generateScript (ensurePreflight)
    // No need to call it twice - the API layer handles it
    
    setScriptData(null);
    setShowRenderQueue(false);
    setAnnouncement("Generating script with AI... Creating scenes and dialogue based on your research...");

    try {
      console.log('[ScriptGen] Starting script generation with:', {
        idea: project.idea,
        speakers: project.speakers,
        duration: project.duration,
        hasResearch: !!rawResearch,
        hasOutline: !!analysis?.suggestedOutlines?.[0],
      });
      
      const result = await podcastApi.generateScript({
        projectId: project.id,
        idea: project.idea,
        research: rawResearch,
        knobs: projectState.knobs,
        speakers: project.speakers,
        durationMinutes: project.duration,
        podcastMode: (project as any)?.podcastMode || "video_only",
        bible: projectState.bible,
        outline: analysis?.suggestedOutlines?.[0],
        analysis: analysis,
        onProgress: (message) => {
          console.log('[ScriptGen] Progress:', message);
          setAnnouncement(message);
        },
      });

      console.log('[ScriptGen] Script generated:', { sceneCount: result.scenes?.length });
      setScriptData(result);
      setShowScriptEditor(true); // Open editor after successful generation
      setIsGeneratingScript(false);
      setAnnouncement("Script generated! Review and edit your scenes below.");
    } catch (error) {
      setIsGeneratingScript(false);
      announceError(setAnnouncement, setAnnouncementSeverityFn, error);
    } finally {
      isGeneratingRef.current = false; // Reset when done
    }
  }, [showScriptEditor, project, research, setScriptData, setShowRenderQueue, setShowScriptEditor, rawResearch, projectState.knobs, projectState.bible, analysis, setShowScriptGenModal, scriptGenStarted, setScriptGenProgressIndex, isGeneratingScript, projectState.scriptData, currentStep])

  const handleProceedToRendering = useCallback((script: Script) => {
    // Clear media cache for all scenes before proceeding to remove old blobs
    script.scenes.forEach((scene) => {
      clearSceneMediaCache(scene.id);
    });
    // Also clear global media cache to ensure clean slate
    clearMediaCache();
    
    // Clear all render jobs to start fresh (removes old videos/images)
    setRenderJobs([]);
    
    setScriptData(script);
    // Create new render jobs with current script scene data
    script.scenes.forEach((scene) => {
      const hasExistingAudio = Boolean(scene.audioUrl);
      const hasExistingImage = Boolean(scene.imageUrl);
      updateRenderJob(scene.id, {
        sceneId: scene.id,
        title: scene.title,
        status: hasExistingAudio ? ("completed" as const) : ("idle" as const),
        progress: hasExistingAudio ? 100 : 0,
        previewUrl: null,
        finalUrl: hasExistingAudio ? scene.audioUrl : null,
        imageUrl: hasExistingImage ? scene.imageUrl : null,
        videoUrl: null,
        jobId: null,
      });
    });
    setShowRenderQueue(true);
    setShowScriptEditor(false);
  }, [setScriptData, setRenderJobs, updateRenderJob, setShowRenderQueue, setShowScriptEditor]);

  const toggleQuery = useCallback((id: string) => {
    if (isResearching) return;
    const current = selectedQueries;
    const next = new Set<string>(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedQueries(next);
  }, [isResearching, selectedQueries, setSelectedQueries]);

  const handleUpdateQuery = useCallback((id: string, newQuery: string, newRationale: string) => {
    const updated = queries.map(q => q.id === id ? { ...q, query: newQuery, rationale: newRationale } : q);
    setQueries(updated);
  }, [queries, setQueries]);

  const handleDeleteQuery = useCallback((id: string) => {
    const updated = queries.filter(q => q.id !== id);
    setQueries(updated);
    // Also remove from selected if it was selected
    if (selectedQueries.has(id)) {
      const newSelected = new Set(selectedQueries);
      newSelected.delete(id);
      setSelectedQueries(newSelected);
    }
  }, [queries, selectedQueries, setQueries, setSelectedQueries]);

  const activeStep = useMemo(() => {
    if (showRenderQueue) return 3;
    if (showScriptEditor) return 2;
    if (currentStep === 'research' || research) return 1;
    if (currentStep === 'analysis' || analysis) return 0;
    return -1;
  }, [showRenderQueue, showScriptEditor, currentStep, research, analysis]);

  const canGenerateScript = Boolean(project && research && rawResearch);

  const handleRegenerate = useCallback(async (feedback?: string) => {
    if (!project) return;
    
    // Prepare the payload from existing project state
    const payload: CreateProjectPayload = {
      ideaOrUrl: project.idea,
      duration: project.duration,
      speakers: project.speakers,
      knobs: projectState.knobs,
      budgetCap: projectState.budgetCap,
      avatarUrl: project.avatarUrl,
      files: {} // No new files for regeneration
    };

    await handleCreate(payload, feedback);
  }, [project, projectState.knobs, projectState.budgetCap, handleCreate]);

  // Regenerate only research queries (keeps other sections intact)
  const handleRegenerateQueries = useCallback(async (feedback: string) => {
    if (!project || !analysis) return;
    
    setAnnouncement("Regenerating research queries...");
    
    try {
      const response = await podcastApi.regenerateResearchQueries({
        idea: project.idea,
        feedback: feedback,
        existing_analysis: analysis,
        bible: projectState.bible,
      });
      
      // Convert to Query format
      const newQueries = response.research_queries.map((rq, idx) => ({
        id: createId("q"),
        query: rq.query,
        rationale: rq.rationale,
        needsRecentStats: /202[45]|latest|trend/i.test(rq.query),
      }));
      
      setQueries(newQueries);
      setSelectedQueries(new Set()); // Don't auto-select - user must choose manually
      setAnnouncement("Research queries regenerated");
    } catch (error) {
      console.error("Failed to regenerate queries:", error);
      setAnnouncement("Failed to regenerate queries");
    }
  }, [project, analysis, projectState.bible, setQueries, setSelectedQueries]);

  const setAnnouncementSeverityFn = useCallback((severity: "info" | "error" | "success") => {
    setAnnouncementSeverity(severity);
  }, []);

  return {
    // State
    isAnalyzing,
    isResearching,
    isGeneratingScript,
    announcement,
    announcementSeverity,
    showResumeAlert,
    showPreflightDialog,
    preflightResponse,
    preflightOperationName,
    showDuplicateDialog,
    duplicateProjectInfo,
    activeStep,
    canGenerateScript,
    // Script Generation Modal
    showScriptGenModal,
    setShowScriptGenModal,
    scriptGenStarted,
    scriptGenProgressIndex,
    // Handlers
    handleCreate,
    handleRegenerate,
    handleRunResearch,
    handleGenerateScript,
    handleProceedToRendering,
    toggleQuery,
    setAnnouncement,
    setAnnouncementSeverity: setAnnouncementSeverityFn,
    setShowResumeAlert,
    setShowPreflightDialog,
    setPreflightResponse,
    setShowDuplicateDialog,
    setDuplicateProjectInfo,
    setResearchProvider,
    getStepLabel,
    handleRegenerateQueries: handleRegenerateQueries,
    handleUpdateQuery,
    handleDeleteQuery,
  };
};
