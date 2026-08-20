import { useState, useCallback, useEffect } from 'react';
import { VideoPlan, Scene, SceneBuildGeneration } from '../services/youtubeApi';
import { Resolution, DurationType, VideoType, YouTubeContentLanguage } from '../components/YouTubeCreator/constants';

export interface YouTubeCreatorState {
  // Step 1: Plan inputs
  userIdea: string;
  durationType: DurationType;
  videoType: VideoType | '';
  targetAudience: string;
  videoGoal: string;
  brandStyle: string;
  referenceImage: string;
  avatarUrl: string | null;
  // Step 1: Language (used for multilingual audio now; later for multilingual planning/scenes)
  language: YouTubeContentLanguage;
  // WaveSpeed Minimax parameter `language_boost`
  languageBoost: string;
  // Note: avatarPreview is not persisted (can be blob URL) - regenerated from avatarUrl
  
  // Step 1: Plan output
  videoPlan: VideoPlan | null;
  /** Include Exa web research in the plan prompt (LinkedIn-style). Default true. */
  enableResearch: boolean;
  
  // Step 2: Scenes
  scenes: Scene[];
  sceneBuildGeneration: SceneBuildGeneration | null;
  editingSceneId: number | null;
  editedScene: Partial<Scene> | null;
  
  // Step 3: Render
  renderTaskId: string | null;
  renderStatus: any;
  renderProgress: number;
  resolution: Resolution;
  combineScenes: boolean;
  
  // UI state
  activeStep: number;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_STATE: YouTubeCreatorState = {
  userIdea: '',
  durationType: 'medium',
  videoType: '',
  targetAudience: '',
  videoGoal: '',
  brandStyle: '',
  referenceImage: '',
  avatarUrl: null,
  language: 'en',
  languageBoost: 'English',
  videoPlan: null,
  enableResearch: true,
  scenes: [],
  sceneBuildGeneration: null,
  editingSceneId: null,
  editedScene: null,
  renderTaskId: null,
  renderStatus: null,
  renderProgress: 0,
  resolution: '480p',
  combineScenes: true,
  activeStep: 0,
};

const STORAGE_KEY = 'youtube_creator_state';

export const YOUTUBE_CREATOR_STATE_KEY = STORAGE_KEY;

export function getYouTubeCreatorStateSnapshot(): YouTubeCreatorState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
        enableResearch:
          typeof parsed.enableResearch === "boolean" ? parsed.enableResearch : true,
      };
    }
  } catch (error) {
    console.error('[getYouTubeCreatorStateSnapshot] Failed to read state', error);
  }
  return { ...DEFAULT_STATE };
}

export function clearYouTubeCreatorStateStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[clearYouTubeCreatorStateStorage] Failed', error);
  }
}

export const useYouTubeCreatorState = () => {
  const [state, setState] = useState<YouTubeCreatorState>(() => {
    // Initialize from localStorage if available
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Restore state with defaults for any missing fields
        const restoredState: YouTubeCreatorState = {
          ...DEFAULT_STATE,
          ...parsed,
          // Ensure arrays are arrays (not null/undefined)
          scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
          enableResearch:
            typeof parsed.enableResearch === "boolean" ? parsed.enableResearch : true,
          // Ensure dates are preserved
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
        
        console.log('[useYouTubeCreatorState] Restored state from localStorage:', {
          hasPlan: !!restoredState.videoPlan,
          scenesCount: restoredState.scenes.length,
          activeStep: restoredState.activeStep,
        });
        
        return restoredState;
      }
    } catch (error) {
      console.error('[useYouTubeCreatorState] Error loading state from localStorage:', error);
    }
    return DEFAULT_STATE;
  });

  // Persist state to localStorage on every change
  useEffect(() => {
    try {
      const stateToSave: YouTubeCreatorState = {
        ...state,
        updatedAt: new Date().toISOString(),
        createdAt: state.createdAt || new Date().toISOString(),
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('[useYouTubeCreatorState] Error saving state to localStorage:', error);
    }
  }, [state]);

  // Update state helper
  const updateState = useCallback((updates: Partial<YouTubeCreatorState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Clear state helper (for reset/new project)
  const clearState = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
    console.log('[useYouTubeCreatorState] State cleared');
  }, []);

  return {
    state,
    updateState,
    clearState,
  };
};

