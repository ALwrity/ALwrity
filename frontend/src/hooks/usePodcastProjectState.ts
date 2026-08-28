import { useState, useCallback, useEffect, useRef } from 'react';
import {
  PodcastAnalysis,
  PodcastEstimate,
  Query,
  Research,
  Script,
  Knobs,
  Job,
  CreateProjectPayload,
  PodcastBible,
} from '../components/PodcastMaker/types';
import { BlogResearchResponse, ResearchProvider } from '../services/blogWriterApi';
import { podcastApi, getCachedVoiceCloneInfo } from '../services/podcastApi';

export interface PodcastProjectState {
  // Project metadata
  project: {
    id: string;
    idea: string;
    duration: number;
    speakers: number;
    podcastMode?: "audio_only" | "video_only" | "audio_video";
    avatarUrl?: string | null;
    avatarPrompt?: string | null;
    avatarPersonaId?: string | null;
    /** Base presenter reference image URL used for cross-scene img2img anchoring (Path B1). */
    presenterReferenceUrl?: string | null;
  } | null;

  
  // Step results
  analysis: PodcastAnalysis | null;
  queries: Query[];
  selectedQueries: Set<string>;
  research: Research | null;
  rawResearch: BlogResearchResponse | null;
  estimate: PodcastEstimate | null;
  scriptData: Script | null;
  bible: PodcastBible | null;
  
  // Render jobs
  renderJobs: Job[];
  
  // Settings
  knobs: Knobs;
  researchProvider: ResearchProvider;
  budgetCap: number;
  
  // UI state
  showScriptEditor: boolean;
  showRenderQueue: boolean;
  
  // Current step tracking
  currentStep: 'create' | 'analysis' | 'research' | 'script' | 'render' | null;
  
  // Final combined video
  finalVideoUrl?: string | null;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;

  // Backend project creation status — prevents 404 sync calls before project exists
  backendProjectCreated?: boolean;
  
  // Track last synced phase to prevent duplicate syncs
  lastSyncedPhase?: string | null;
}

const DEFAULT_KNOBS: Knobs = {
  voice_emotion: "neutral",
  voice_speed: 1,
  voice_id: "Wise_Woman",
  custom_voice_id: undefined,
  is_voice_clone: undefined,
  voice_sample_url: undefined,
  voice_clone_engine: undefined,
  voice_clone_stale: false,
  resolution: "720p",
  scene_length_target: 45,
  sample_rate: 24000,
  bitrate: "standard",
};

/**
 * Merge voice clone cache into knobs if the project knobs don't already have it.
 * This ensures projects created before voice clone, or after a new clone is made,
 * automatically pick up the latest voice clone info.
 */
function mergeVoiceCloneCacheIntoKnobs(knobs: Knobs): Knobs {
  if (knobs.custom_voice_id) {
    return knobs;
  }
  const cached = getCachedVoiceCloneInfo();
  if (!cached || !cached.isVoiceClone) {
    return knobs;
  }
  return {
    ...knobs,
    voice_id: knobs.voice_id || "Wise_Woman",
    custom_voice_id: cached.customVoiceId,
    is_voice_clone: true,
    voice_sample_url: cached.voiceSampleUrl,
    voice_clone_engine: cached.engine || "qwen3",
    voice_clone_stale: cached.stale || false,
  };
}

const DEFAULT_STATE: PodcastProjectState = {
  project: null,
  analysis: null,
  queries: [],
  selectedQueries: new Set(),
  research: null,
  rawResearch: null,
  estimate: null,
  scriptData: null,
  bible: null,
  renderJobs: [],
  knobs: DEFAULT_KNOBS,
  researchProvider: "exa",
  budgetCap: 50,
  showScriptEditor: false,
  showRenderQueue: false,
  currentStep: null,
  backendProjectCreated: false,
};

const STORAGE_KEY = 'podcast_project_state';

const normalizeResearchCostEst = (research: any): Research | null => {
  if (!research) return research;

  const fromSnakeCase = research.cost_est;
  const fromCamelCase = research.costEst;
  const legacyCost = typeof research.cost === "number" ? research.cost : undefined;
  const normalizedCostEst = fromCamelCase || (fromSnakeCase ? {
    total: Number(fromSnakeCase.total || 0),
    breakdown: Array.isArray(fromSnakeCase.breakdown) ? fromSnakeCase.breakdown : [],
    currency: fromSnakeCase.currency || "USD",
    last_updated: fromSnakeCase.last_updated || new Date().toISOString(),
  } : undefined);

  return {
    ...research,
    costEst: normalizedCostEst || (legacyCost !== undefined ? {
      total: legacyCost,
      breakdown: [],
      currency: "USD",
      last_updated: new Date().toISOString(),
    } : undefined),
  };
};

export const usePodcastProjectState = () => {
  const [state, setState] = useState<PodcastProjectState>(() => {
    // Initialize from localStorage if available
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Restore Sets from arrays
        const restoredState: PodcastProjectState = {
          ...DEFAULT_STATE,
          ...parsed,
          research: normalizeResearchCostEst(parsed.research),
          selectedQueries: parsed.selectedQueries ? new Set(parsed.selectedQueries) : new Set(),
          renderJobs: parsed.renderJobs || [],
        };
        
        return restoredState;
      }
    } catch (error) {
      console.error('Error loading podcast project state from localStorage:', error);
    }
    return DEFAULT_STATE;
  });

  // Debounce ref for database sync
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist state to localStorage on every change
  useEffect(() => {
    try {
      // Convert Sets to arrays for JSON serialization
      const serializableState = {
        ...state,
        selectedQueries: Array.from(state.selectedQueries),
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState));
    } catch (error) {
      console.error('Error saving podcast project state to localStorage:', error);
    }
  }, [state]);

  // Sync to database ONLY on phase transitions (not on every state change)
  // This ensures we sync at: Create → Analyze → Research → Script → Render
  useEffect(() => {
    if (!state.project || !state.project.id || !state.backendProjectCreated) return;
    if (!state.currentStep) return;

    // Skip if already synced this phase (handles duplicate calls from handleCreate/etc)
    if (state.currentStep === state.lastSyncedPhase) {
      return;
    }

    const projectId = state.project.id;

    // Debounce - wait for state to settle before syncing
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`[Sync] Saving project at phase: ${state.currentStep}`);
        
        const dbState = {
          analysis: state.analysis,
          queries: state.queries,
          selected_queries: Array.from(state.selectedQueries),
          research: state.research,
          raw_research: state.rawResearch,
          estimate: state.estimate,
          script_data: state.scriptData,
          bible: state.bible,
          render_jobs: state.renderJobs,
          knobs: state.knobs,
          research_provider: state.researchProvider,
          show_script_editor: state.showScriptEditor,
          show_render_queue: state.showRenderQueue,
          current_step: state.currentStep,
          status: state.currentStep === 'render' && state.renderJobs.every(j => j.status === 'completed') ? 'completed' : 'in_progress',
          avatar_url: state.project?.avatarUrl || null,
          presenter_reference_url: state.project?.presenterReferenceUrl || null,
        };

        const saved = await podcastApi.saveProject(projectId, dbState);
        
        if (saved) {
          setState((prev) => ({ ...prev, lastSyncedPhase: prev.currentStep }));
          console.log(`[Sync] Project saved successfully at phase: ${state.currentStep}`);
        } else {
          console.warn(`[Sync] Failed to save project at phase: ${state.currentStep} - will retry on next phase change`);
        }
      } catch (error) {
        console.error('[Sync] Error saving project:', error);
      }
    }, 1500);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  // Only sync when phase changes - not on every state field change
  }, [state.currentStep, state.backendProjectCreated]);

  // Setters
  const setProject = useCallback((project: PodcastProjectState['project']) => {
    const newStep = project ? 'analysis' : null;
    setState((prev) => ({ 
      ...prev, 
      project, 
      currentStep: newStep, 
      lastSyncedPhase: prev.currentStep, // Mark previous phase as synced
      updatedAt: new Date().toISOString() 
    }));
  }, []);

  const setAnalysis = useCallback((analysis: PodcastProjectState['analysis']) => {
    setState((prev) => ({ 
      ...prev, 
      analysis, 
      currentStep: analysis ? 'research' : prev.currentStep,
      lastSyncedPhase: prev.currentStep, // Mark previous phase as synced
      updatedAt: new Date().toISOString() 
    }));
  }, []);

  const setQueries = useCallback((queries: Query[]) => {
    setState((prev) => ({ ...prev, queries, updatedAt: new Date().toISOString() }));
  }, []);

  const setSelectedQueries = useCallback((selectedQueries: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setState((prev) => {
      const newQueries = typeof selectedQueries === 'function' ? selectedQueries(prev.selectedQueries) : selectedQueries;
      return { ...prev, selectedQueries: newQueries, updatedAt: new Date().toISOString() };
    });
  }, []);

  const setResearch = useCallback((research: PodcastProjectState['research']) => {
    setState((prev) => ({ 
      ...prev, 
      research, 
      currentStep: research ? 'script' : prev.currentStep,
      lastSyncedPhase: prev.currentStep, // Mark previous phase as synced
      updatedAt: new Date().toISOString() 
    }));
  }, []);

  const setRawResearch = useCallback((rawResearch: PodcastProjectState['rawResearch']) => {
    setState((prev) => ({ ...prev, rawResearch, updatedAt: new Date().toISOString() }));
  }, []);

  const setEstimate = useCallback((estimate: PodcastProjectState['estimate']) => {
    setState((prev) => ({ ...prev, estimate, updatedAt: new Date().toISOString() }));
  }, []);

  const setScriptData = useCallback((scriptData: PodcastProjectState['scriptData']) => {
    setState((prev) => ({ 
      ...prev, 
      scriptData, 
      currentStep: scriptData ? 'render' : prev.currentStep,
      lastSyncedPhase: prev.currentStep, // Mark previous phase as synced
      updatedAt: new Date().toISOString() 
    }));
  }, []);

  const setBible = useCallback((bible: PodcastBible | null) => {
    setState((prev) => ({ ...prev, bible, updatedAt: new Date().toISOString() }));
  }, []);

  const setRenderJobs = useCallback((renderJobs: Job[]) => {
    setState((prev) => ({ ...prev, renderJobs, updatedAt: new Date().toISOString() }));
  }, []);

  const updateRenderJob = useCallback((sceneId: string, updates: Partial<Job>) => {
    setState((prev) => {
      const existingJob = prev.renderJobs.find((job) => job.sceneId === sceneId);
      
      if (existingJob) {
        // Update existing job
        return {
          ...prev,
          renderJobs: prev.renderJobs.map((job) =>
            job.sceneId === sceneId ? { ...job, ...updates } : job
          ),
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Create new job if it doesn't exist
        const newJob: Job = {
          sceneId,
          title: updates.title || sceneId,
          status: updates.status || "idle",
          progress: updates.progress || 0,
          previewUrl: updates.previewUrl || null,
          finalUrl: updates.finalUrl || null,
          videoUrl: updates.videoUrl || null,
          imageUrl: updates.imageUrl || null,
          jobId: updates.jobId || null,
          taskId: updates.taskId || null,
          cost: updates.cost || null,
          provider: updates.provider || null,
          voiceId: updates.voiceId || null,
          fileSize: updates.fileSize || null,
          avatarImageUrl: updates.avatarImageUrl || null,
        };
        return {
          ...prev,
          renderJobs: [...prev.renderJobs, newJob],
          updatedAt: new Date().toISOString(),
        };
      }
    });
  }, []);

  const setKnobs = useCallback((knobs: Knobs) => {
    setState((prev) => ({ ...prev, knobs, updatedAt: new Date().toISOString() }));
  }, []);

  const setResearchProvider = useCallback((provider: ResearchProvider) => {
    setState((prev) => ({ ...prev, researchProvider: provider, updatedAt: new Date().toISOString() }));
  }, []);

  const setBudgetCap = useCallback((cap: number) => {
    setState((prev) => ({ ...prev, budgetCap: cap, updatedAt: new Date().toISOString() }));
  }, []);

  const setShowScriptEditor = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showScriptEditor: show, updatedAt: new Date().toISOString() }));
  }, []);

  const setShowRenderQueue = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showRenderQueue: show, updatedAt: new Date().toISOString() }));
  }, []);

  const setCurrentStep = useCallback((step: PodcastProjectState['currentStep']) => {
    setState((prev) => ({ ...prev, currentStep: step, updatedAt: new Date().toISOString() }));
  }, []);

  const setBackendProjectCreated = useCallback((created: boolean) => {
    setState((prev) => ({ ...prev, backendProjectCreated: created }));
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Initialize project from payload
  const initializeProject = useCallback(async (payload: CreateProjectPayload, projectId: string, avatarUrlOverride?: string | null) => {
    // Create project in database
    let dbProject: any = null;
    const finalAvatarUrl = avatarUrlOverride !== undefined ? avatarUrlOverride : payload.avatarUrl;
    
    try {
      dbProject = await podcastApi.initProject({
        project_id: projectId,
        idea: payload.ideaOrUrl,
        duration: payload.duration,
        speakers: payload.speakers,
        budget_cap: payload.budgetCap,
        avatar_url: finalAvatarUrl,
        presenter_reference_url: payload.presenterReferenceUrl,
      });
    } catch (error: any) {
      const errorStr = error?.message || "";
      if (errorStr.includes("DUPLICATE_IDEA")) {
        // Re-throw duplicate idea error for UI handling
        throw error;
      }
      console.error('Error creating project in database:', error);
      // Continue anyway - localStorage fallback
    }

    setState((prev) => ({
      ...prev,
      project: {
        id: projectId,
        idea: payload.ideaOrUrl,
        duration: payload.duration,
        speakers: payload.speakers,
        avatarUrl: finalAvatarUrl || null,
        avatarPrompt: null, // Will be set when avatar is generated
        avatarPersonaId: null,
        presenterReferenceUrl: payload.presenterReferenceUrl || dbProject?.presenter_reference_url || null,
      },
      knobs: payload.knobs,
      budgetCap: payload.budgetCap,
      bible: dbProject?.bible || null,
      currentStep: 'analysis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    return dbProject;
  }, []);

  // Load project from database
  const loadProjectFromDb = useCallback(async (projectId: string) => {
    try {
      const dbProject = await podcastApi.loadProject(projectId);
      
      // Restore state from database
      setState((prev) => ({
        ...prev,
        project: {
          id: dbProject.project_id,
          idea: dbProject.idea,
          duration: dbProject.duration,
          speakers: dbProject.speakers,
          avatarUrl: dbProject.avatar_url || null,
          avatarPrompt: dbProject.avatar_prompt || null,
          avatarPersonaId: dbProject.avatar_persona_id || null,
          presenterReferenceUrl: dbProject.presenter_reference_url || null,
        },
        analysis: dbProject.analysis,
        queries: dbProject.queries || [],
        selectedQueries: new Set(dbProject.selected_queries || []),
        research: normalizeResearchCostEst(dbProject.research),
        rawResearch: dbProject.raw_research,
        estimate: dbProject.estimate,
        scriptData: dbProject.script_data,
        bible: dbProject.bible,
        renderJobs: dbProject.render_jobs || [],
        knobs: mergeVoiceCloneCacheIntoKnobs({ ...DEFAULT_KNOBS, ...(dbProject.knobs || {}) }),
        researchProvider: dbProject.research_provider || 'exa',
        budgetCap: dbProject.budget_cap || 50,
        showScriptEditor: dbProject.show_script_editor || false,
        showRenderQueue: dbProject.show_render_queue || false,
        currentStep: dbProject.current_step || null,
        finalVideoUrl: dbProject.final_video_url || null,
        createdAt: dbProject.created_at,
        updatedAt: dbProject.updated_at,
        backendProjectCreated: true,
      }));
    } catch (error) {
      console.error('Error loading project from database:', error);
      throw error;
    }
  }, []);

  return {
    // State
    ...state,

    // Setters
    setProject,
    setAnalysis,
    setQueries,
    setSelectedQueries,
    setResearch,
    setRawResearch,
    setEstimate,
    setScriptData,
    setBible,
    setRenderJobs,
    updateRenderJob,
    setKnobs,
    setResearchProvider,
    setBudgetCap,
    setShowScriptEditor,
    setShowRenderQueue,
    setCurrentStep,
    setBackendProjectCreated,

    // Helpers
    resetState,
    initializeProject,
    loadProjectFromDb,
  };
};
