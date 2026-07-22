import { useState, useCallback, useEffect } from 'react';
import {
  StoryGenerationRequest,
  StoryProjectSummary,
  CreateStoryProjectRequest,
  UpdateStoryProjectRequest,
  storyWriterApi,
} from '../services/storyWriterApi';

export interface SceneAnimationResume {
  predictionId: string;
  duration: 5 | 10;
  message?: string;
  createdAt?: string;
}

export interface StoryWriterState {
  // Persistent project identity
  projectId: string | null;
  projectTitle: string | null;
  // Mode and template selection
  storyMode: 'marketing' | 'pure';
  storyTemplate: 'product_story' | 'brand_manifesto' | 'founder_story' | 'customer_story' | null;
  // Story parameters (Setup phase)
  persona: string;
  storySetting: string;
  characters: string;
  plotElements: string;
  writingStyle: string;
  storyTone: string;
  narrativePOV: string;
  audienceAgeGroup: string;
  contentRating: string;
  endingPreference: string;
  storyLength: string;
  enableExplainer: boolean;
  enableIllustration: boolean;
  enableNarration: boolean;
  enableVideoNarration: boolean;

  // Image generation settings
  imageProvider: string | null;
  imageWidth: number;
  imageHeight: number;
  imageModel: string | null;

  // Video generation settings
  videoFps: number;
  videoTransitionDuration: number;

  // Audio generation settings
  audioProvider: string;
  audioLang: string;
  audioSlow: boolean;
  audioRate: number;

  // Anime-specific structured data
  animeBible: any | null;

  // Generated content
  premise: string | null;
  outline: string | null;
  outlineScenes: any[] | null; // Structured scenes from outline
  isOutlineStructured: boolean;
  storyContent: string | null;
  isComplete: boolean;
  autoGenerateOnWriting: boolean;
  sceneImages: Map<number, string> | null; // Generated image URLs by scene number
  sceneAudio: Map<number, string> | null; // Generated audio URLs by scene number
  storyVideo: string | null; // Generated video URL
  sceneHdVideos: Map<number, string> | null; // Approved HD video URLs by scene number
  sceneAnimatedVideos: Map<number, string> | null; // Animated scene preview videos
  sceneAnimationResumables: Map<number, SceneAnimationResume> | null; // Pending resume info per scene
  hdVideoGenerationStatus: 'idle' | 'generating' | 'awaiting_approval' | 'completed' | 'paused';
  currentHdSceneIndex: number; // Which scene is currently being generated/reviewed

  // Task management
  currentTaskId: string | null;
  generationProgress: number;
  generationMessage: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_STATE: Partial<StoryWriterState> = {
  projectId: null,
  projectTitle: null,
  storyMode: 'marketing',
  storyTemplate: 'product_story',
  persona: '',
  storySetting: '',
  characters: '',
  plotElements: '',
  writingStyle: 'Formal',
  storyTone: 'Suspenseful',
  narrativePOV: 'Third Person Limited',
  audienceAgeGroup: 'Adults (18+)',
  contentRating: 'PG-13',
  endingPreference: 'Happy',
  storyLength: 'Medium',
  enableExplainer: true,
  enableIllustration: true,
  enableNarration: true,
  enableVideoNarration: true,
  // Image generation settings
  imageProvider: null,
  imageWidth: 1024,
  imageHeight: 1024,
  imageModel: null,
  // Video generation settings
  videoFps: 24,
  videoTransitionDuration: 0.5,
  // Audio generation settings
  audioProvider: 'gtts',
  audioLang: 'en',
  audioSlow: false,
  audioRate: 150,
  premise: null,
  outline: null,
  outlineScenes: null,
  isOutlineStructured: false,
  storyContent: null,
  isComplete: false,
  autoGenerateOnWriting: false,
  sceneImages: null,
  sceneAudio: null,
  storyVideo: null,
  sceneHdVideos: null,
  sceneAnimatedVideos: null,
  sceneAnimationResumables: null,
  hdVideoGenerationStatus: 'idle',
  currentHdSceneIndex: 0,
  currentTaskId: null,
  generationProgress: 0,
  generationMessage: null,
  isLoading: false,
  error: null,
  animeBible: null,
};

// Mapping for old values to new values (for migration)
const AUDIENCE_AGE_GROUP_MIGRATION: Record<string, string> = {
  'Adults': 'Adults (18+)',
  'Children': 'Children (5-12)',
  'Young Adults': 'Young Adults (13-17)',
};

// Valid audience age groups
const VALID_AUDIENCE_AGE_GROUPS = ['Children (5-12)', 'Young Adults (13-17)', 'Adults (18+)', 'All Ages'];

export const useStoryWriterState = () => {
  const [state, setState] = useState<StoryWriterState>(() => {
    // Initialize from localStorage if available
    try {
      const saved = localStorage.getItem('story_writer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Migrate old audienceAgeGroup values to new format
        if (parsed.audienceAgeGroup && AUDIENCE_AGE_GROUP_MIGRATION[parsed.audienceAgeGroup]) {
          parsed.audienceAgeGroup = AUDIENCE_AGE_GROUP_MIGRATION[parsed.audienceAgeGroup];
        }
        // Validate audienceAgeGroup is in valid list, if not, use default
        if (parsed.audienceAgeGroup && !VALID_AUDIENCE_AGE_GROUPS.includes(parsed.audienceAgeGroup)) {
          console.warn(`Invalid audienceAgeGroup value: ${parsed.audienceAgeGroup}, using default`);
          parsed.audienceAgeGroup = DEFAULT_STATE.audienceAgeGroup;
        }
        
        // Convert arrays back to Maps
        const restoredState = {
          ...DEFAULT_STATE,
          ...parsed,
          sceneImages: parsed.sceneImages ? new Map(parsed.sceneImages) : null,
          sceneAudio: parsed.sceneAudio ? new Map(parsed.sceneAudio) : null,
          sceneHdVideos: parsed.sceneHdVideos ? new Map(parsed.sceneHdVideos) : null,
          sceneAnimatedVideos: parsed.sceneAnimatedVideos ? new Map(parsed.sceneAnimatedVideos) : null,
          sceneAnimationResumables: parsed.sceneAnimationResumables ? new Map(parsed.sceneAnimationResumables) : null,
        };
        
        return restoredState as StoryWriterState;
      }
    } catch (error) {
      console.error('Error loading story writer state from localStorage:', error);
    }
    return DEFAULT_STATE as StoryWriterState;
  });

  // Fix invalid audienceAgeGroup values whenever state changes
  useEffect(() => {
    if (state.audienceAgeGroup && !VALID_AUDIENCE_AGE_GROUPS.includes(state.audienceAgeGroup)) {
      // Migrate old values to new format
      const migratedValue = AUDIENCE_AGE_GROUP_MIGRATION[state.audienceAgeGroup] || (DEFAULT_STATE.audienceAgeGroup as string);
      if (migratedValue !== state.audienceAgeGroup) {
        console.log(`Migrating audienceAgeGroup from '${state.audienceAgeGroup}' to '${migratedValue}'`);
        setState((prev) => ({ ...prev, audienceAgeGroup: migratedValue }));
      }
    }
  }, [state.audienceAgeGroup]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      // Don't persist loading/error states
      const { isLoading, error, ...persistableState } = state;
      
      // Ensure audienceAgeGroup is valid before persisting
      let validAudienceAgeGroup = persistableState.audienceAgeGroup;
      if (!VALID_AUDIENCE_AGE_GROUPS.includes(validAudienceAgeGroup)) {
        validAudienceAgeGroup = AUDIENCE_AGE_GROUP_MIGRATION[validAudienceAgeGroup] || (DEFAULT_STATE.audienceAgeGroup as string);
        // Update state if corrected
        if (validAudienceAgeGroup !== persistableState.audienceAgeGroup) {
          setState((prev) => ({ ...prev, audienceAgeGroup: validAudienceAgeGroup }));
        }
      }
      
      // Convert Maps to arrays for JSON serialization
      const serializableState = {
        ...persistableState,
        audienceAgeGroup: validAudienceAgeGroup,
        sceneImages: persistableState.sceneImages ? Array.from(persistableState.sceneImages.entries()) : null,
        sceneAudio: persistableState.sceneAudio ? Array.from(persistableState.sceneAudio.entries()) : null,
        sceneHdVideos: persistableState.sceneHdVideos ? Array.from(persistableState.sceneHdVideos.entries()) : null,
        sceneAnimatedVideos: persistableState.sceneAnimatedVideos
          ? Array.from(persistableState.sceneAnimatedVideos.entries())
          : null,
        sceneAnimationResumables: persistableState.sceneAnimationResumables
          ? Array.from(persistableState.sceneAnimationResumables.entries())
          : null,
        animeBible: persistableState.animeBible || null,
      };
      
      localStorage.setItem('story_writer_state', JSON.stringify(serializableState));
    } catch (error) {
      console.error('Error saving story writer state to localStorage:', error);
    }
  }, [state]);

  // Setters
  const setStoryMode = useCallback((storyMode: 'marketing' | 'pure') => {
    setState((prev) => ({ ...prev, storyMode }));
  }, []);

  const setStoryTemplate = useCallback(
    (storyTemplate: 'product_story' | 'brand_manifesto' | 'founder_story' | 'customer_story' | null) => {
      setState((prev) => ({ ...prev, storyTemplate }));
    },
  []);

  const setAnimeBible = useCallback((animeBible: any | null) => {
    setState((prev) => ({ ...prev, animeBible }));
  }, []);

  const setPersona = useCallback((persona: string) => {
    setState((prev) => ({ ...prev, persona }));
  }, []);

  const setStorySetting = useCallback((setting: string) => {
    setState((prev) => ({ ...prev, storySetting: setting }));
  }, []);

  const setCharacters = useCallback((characters: string) => {
    setState((prev) => ({ ...prev, characters }));
  }, []);

  const setPlotElements = useCallback((plotElements: string) => {
    setState((prev) => ({ ...prev, plotElements }));
  }, []);

  const setWritingStyle = useCallback((style: string) => {
    setState((prev) => ({ ...prev, writingStyle: style }));
  }, []);

  const setStoryTone = useCallback((tone: string) => {
    setState((prev) => ({ ...prev, storyTone: tone }));
  }, []);

  const setNarrativePOV = useCallback((pov: string) => {
    setState((prev) => ({ ...prev, narrativePOV: pov }));
  }, []);

  const setAudienceAgeGroup = useCallback((ageGroup: string) => {
    // Migrate old values to new format
    const migratedAgeGroup = AUDIENCE_AGE_GROUP_MIGRATION[ageGroup] || ageGroup;
    // Validate the value is in the valid list
    if (VALID_AUDIENCE_AGE_GROUPS.includes(migratedAgeGroup)) {
      setState((prev) => ({ ...prev, audienceAgeGroup: migratedAgeGroup }));
    } else {
      console.warn(`Invalid audienceAgeGroup value: ${ageGroup}, using default`);
      setState((prev) => ({ ...prev, audienceAgeGroup: DEFAULT_STATE.audienceAgeGroup as string }));
    }
  }, []);

  const setContentRating = useCallback((rating: string) => {
    setState((prev) => ({ ...prev, contentRating: rating }));
  }, []);

  const setEndingPreference = useCallback((ending: string) => {
    setState((prev) => ({ ...prev, endingPreference: ending }));
  }, []);

  const setStoryLength = useCallback((length: string) => {
    setState((prev) => ({ ...prev, storyLength: length }));
  }, []);

  const setEnableExplainer = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enableExplainer: enabled }));
  }, []);

  const setEnableIllustration = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enableIllustration: enabled }));
  }, []);

  const setEnableNarration = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enableNarration: enabled }));
  }, []);

  const setEnableVideoNarration = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enableVideoNarration: enabled }));
  }, []);

  // Image generation setters
  const setImageProvider = useCallback((provider: string | null) => {
    setState((prev) => ({ ...prev, imageProvider: provider }));
  }, []);

  const setImageWidth = useCallback((width: number) => {
    setState((prev) => ({ ...prev, imageWidth: width }));
  }, []);

  const setImageHeight = useCallback((height: number) => {
    setState((prev) => ({ ...prev, imageHeight: height }));
  }, []);

  const setImageModel = useCallback((model: string | null) => {
    setState((prev) => ({ ...prev, imageModel: model }));
  }, []);

  // Video generation setters
  const setVideoFps = useCallback((fps: number) => {
    setState((prev) => ({ ...prev, videoFps: fps }));
  }, []);

  const setVideoTransitionDuration = useCallback((duration: number) => {
    setState((prev) => ({ ...prev, videoTransitionDuration: duration }));
  }, []);

  // Audio generation setters
  const setAudioProvider = useCallback((provider: string) => {
    setState((prev) => ({ ...prev, audioProvider: provider }));
  }, []);

  const setAudioLang = useCallback((lang: string) => {
    setState((prev) => ({ ...prev, audioLang: lang }));
  }, []);

  const setAudioSlow = useCallback((slow: boolean) => {
    setState((prev) => ({ ...prev, audioSlow: slow }));
  }, []);

  const setAudioRate = useCallback((rate: number) => {
    setState((prev) => ({ ...prev, audioRate: rate }));
  }, []);

  const setPremise = useCallback((premise: string | null) => {
    setState((prev) => ({ ...prev, premise }));
  }, []);

  const setOutline = useCallback((outline: string | null) => {
    setState((prev) => ({ ...prev, outline }));
  }, []);

  const setOutlineScenes = useCallback((scenes: any[] | null) => {
    setState((prev) => ({ ...prev, outlineScenes: scenes, isOutlineStructured: scenes !== null && scenes.length > 0 }));
  }, []);

  const setIsOutlineStructured = useCallback((isStructured: boolean) => {
    setState((prev) => ({ ...prev, isOutlineStructured: isStructured }));
  }, []);

  const setStoryContent = useCallback((content: string | null) => {
    setState((prev) => ({ ...prev, storyContent: content }));
  }, []);

  const setSceneImages = useCallback((images: Map<number, string> | null) => {
    setState((prev) => ({ ...prev, sceneImages: images }));
  }, []);

  const setSceneAnimatedVideos = useCallback((videos: Map<number, string> | null) => {
    setState((prev) => ({ ...prev, sceneAnimatedVideos: videos }));
  }, []);

  const setSceneAnimationResumables = useCallback((resumables: Map<number, SceneAnimationResume> | null) => {
    setState((prev) => ({ ...prev, sceneAnimationResumables: resumables }));
  }, []);

  const setSceneAudio = useCallback((audio: Map<number, string> | null) => {
    setState((prev) => ({ ...prev, sceneAudio: audio }));
  }, []);

  const setStoryVideo = useCallback((video: string | null) => {
    setState((prev) => ({ ...prev, storyVideo: video }));
  }, []);

  const setSceneHdVideos = useCallback((videos: Map<number, string> | null) => {
    setState((prev) => ({ ...prev, sceneHdVideos: videos }));
  }, []);

  const setHdVideoGenerationStatus = useCallback((status: 'idle' | 'generating' | 'awaiting_approval' | 'completed' | 'paused') => {
    setState((prev) => ({ ...prev, hdVideoGenerationStatus: status }));
  }, []);

  const setCurrentHdSceneIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, currentHdSceneIndex: index }));
  }, []);

  const setIsComplete = useCallback((complete: boolean) => {
    setState((prev) => ({ ...prev, isComplete: complete }));
  }, []);

  const setAutoGenerateOnWriting = useCallback((autoGenerate: boolean) => {
    setState((prev) => ({ ...prev, autoGenerateOnWriting: autoGenerate }));
  }, []);

  const setCurrentTaskId = useCallback((taskId: string | null) => {
    setState((prev) => ({ ...prev, currentTaskId: taskId }));
  }, []);

  const setGenerationProgress = useCallback((progress: number) => {
    setState((prev) => ({ ...prev, generationProgress: progress }));
  }, []);

  const setGenerationMessage = useCallback((message: string | null) => {
    setState((prev) => ({ ...prev, generationMessage: message }));
  }, []);

  const setIsLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setProjectMeta = useCallback((projectId: string | null, title: string | null) => {
    setState((prev) => ({ ...prev, projectId, projectTitle: title }));
  }, []);

  const mapProjectToState = useCallback((project: StoryProjectSummary): StoryWriterState => {
    const outlineScenes = (project.outline && Array.isArray((project.outline as any).scenes)
      ? (project.outline as any).scenes
      : null)
      || project.scenes
      || null;

    const mediaState = (project.media_state as Record<string, any>) || {};

    const loadedSceneImages = mediaState.scene_images
      ? new Map<number, string>(Object.entries(mediaState.scene_images).map(([k, v]) => [Number(k), v as string]))
      : null;

    const loadedSceneAudio = mediaState.scene_audio
      ? new Map<number, string>(Object.entries(mediaState.scene_audio).map(([k, v]) => [Number(k), v as string]))
      : null;

    return {
      ...(DEFAULT_STATE as StoryWriterState),
      projectId: project.project_id,
      projectTitle: project.title || null,
      storyMode: (project.story_mode as any) || (DEFAULT_STATE.storyMode as 'marketing' | 'pure'),
      storyTemplate: (project.story_template as any) || DEFAULT_STATE.storyTemplate || null,
      premise: (project.setup as any)?.premise || null,
      persona: (project.setup as any)?.persona || '',
      storySetting: (project.setup as any)?.story_setting || '',
      characters: (project.setup as any)?.character_input || '',
      plotElements: (project.setup as any)?.plot_elements || '',
      writingStyle: (project.setup as any)?.writing_style || (DEFAULT_STATE.writingStyle as string),
      storyTone: (project.setup as any)?.story_tone || (DEFAULT_STATE.storyTone as string),
      narrativePOV: (project.setup as any)?.narrative_pov || (DEFAULT_STATE.narrativePOV as string),
      audienceAgeGroup:
        (project.setup as any)?.audience_age_group || (DEFAULT_STATE.audienceAgeGroup as string),
      contentRating:
        (project.setup as any)?.content_rating || (DEFAULT_STATE.contentRating as string),
      endingPreference:
        (project.setup as any)?.ending_preference || (DEFAULT_STATE.endingPreference as string),
      storyLength: (project.setup as any)?.story_length || (DEFAULT_STATE.storyLength as string),
      enableExplainer:
        (project.setup as any)?.enable_explainer ??
        (DEFAULT_STATE.enableExplainer as boolean),
      enableIllustration:
        (project.setup as any)?.enable_illustration ??
        (DEFAULT_STATE.enableIllustration as boolean),
      enableNarration:
        (project.setup as any)?.enable_narration ??
        (DEFAULT_STATE.enableNarration as boolean),
      enableVideoNarration:
        (project.setup as any)?.enable_video_narration ??
        (DEFAULT_STATE.enableVideoNarration as boolean),
      outline: (project.outline as any)?.outline_text || null,
      outlineScenes,
      isOutlineStructured: Boolean(outlineScenes && outlineScenes.length > 0),
      storyContent: (project.story_content as any)?.story || null,
      isComplete: project.is_complete,
      animeBible: project.anime_bible || null,
      sceneImages: loadedSceneImages,
      sceneAudio: loadedSceneAudio,
      storyVideo: mediaState.story_video || null,
      sceneHdVideos: null,
      sceneAnimatedVideos: null,
      sceneAnimationResumables: null,
      hdVideoGenerationStatus: mediaState.hd_video_status ||
        (DEFAULT_STATE.hdVideoGenerationStatus as any),
      currentHdSceneIndex:
        mediaState.current_hd_scene_index ||
        (DEFAULT_STATE.currentHdSceneIndex as number),
      currentTaskId: mediaState.current_task_id || null,
      generationProgress:
        mediaState.generation_progress ||
        (DEFAULT_STATE.generationProgress as number),
      generationMessage:
        mediaState.generation_message ||
        (DEFAULT_STATE.generationMessage as string | null),
      isLoading: false,
      error: null,
      autoGenerateOnWriting: DEFAULT_STATE.autoGenerateOnWriting as boolean,
      audioProvider: DEFAULT_STATE.audioProvider as string,
      audioLang: DEFAULT_STATE.audioLang as string,
      audioSlow: DEFAULT_STATE.audioSlow as boolean,
      audioRate: DEFAULT_STATE.audioRate as number,
      imageProvider: DEFAULT_STATE.imageProvider as string | null,
      imageWidth: DEFAULT_STATE.imageWidth as number,
      imageHeight: DEFAULT_STATE.imageHeight as number,
      imageModel: DEFAULT_STATE.imageModel as string | null,
      videoFps: DEFAULT_STATE.videoFps as number,
      videoTransitionDuration: DEFAULT_STATE.videoTransitionDuration as number,
    };
  }, []);

  const loadProjectFromDb = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const project = await storyWriterApi.loadStoryProject(projectId);
      setState(() => mapProjectToState(project));
    } catch (error) {
      console.error('Error loading story project from database:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mapProjectToState, setIsLoading, setError]);

  const saveProjectToDb = useCallback(async (overrideProjectId?: string) => {
    const projectId = overrideProjectId || state.projectId;
    if (!projectId) {
      return;
    }
    try {
      const payload: UpdateStoryProjectRequest = {
        title: state.projectTitle || undefined,
        story_mode: state.storyMode,
        story_template: state.storyTemplate,
        setup: {
          premise: state.premise,
          persona: state.persona,
          story_setting: state.storySetting,
          character_input: state.characters,
          plot_elements: state.plotElements,
          writing_style: state.writingStyle,
          story_tone: state.storyTone,
          narrative_pov: state.narrativePOV,
          audience_age_group: state.audienceAgeGroup,
          content_rating: state.contentRating,
          ending_preference: state.endingPreference,
          story_length: state.storyLength,
          enable_explainer: state.enableExplainer,
          enable_illustration: state.enableIllustration,
          enable_narration: state.enableNarration,
          enable_video_narration: state.enableVideoNarration,
        },
        outline: state.outline
          ? {
              outline_text: state.outline,
              scenes: state.outlineScenes || [],
            }
          : undefined,
        scenes: state.outlineScenes || undefined,
        story_content: state.storyContent ? { story: state.storyContent } : undefined,
        anime_bible: state.animeBible || undefined,
        media_state: (state.storyVideo || (state.sceneImages && state.sceneImages.size > 0) || (state.sceneAudio && state.sceneAudio.size > 0))
          ? {
              story_video: state.storyVideo || undefined,
              hd_video_status: state.hdVideoGenerationStatus,
              current_hd_scene_index: state.currentHdSceneIndex,
              current_task_id: state.currentTaskId || undefined,
              generation_progress: state.generationProgress,
              generation_message: state.generationMessage || undefined,
              scene_images: state.sceneImages && state.sceneImages.size > 0
                ? Object.fromEntries(state.sceneImages)
                : undefined,
              scene_audio: state.sceneAudio && state.sceneAudio.size > 0
                ? Object.fromEntries(state.sceneAudio)
                : undefined,
            }
          : undefined,
        is_complete: state.isComplete,
      };

      try {
        await storyWriterApi.updateStoryProject(projectId, payload);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          // Project doesn't exist yet — create it first, then retry update
          const title = state.projectTitle || (state.premise ? state.premise.trim().slice(0, 80) : 'Untitled Story');
          await storyWriterApi.createStoryProject({
            project_id: projectId,
            title,
            story_mode: state.storyMode,
            story_template: state.storyTemplate,
            setup: payload.setup,
          });
          await storyWriterApi.updateStoryProject(projectId, payload);
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error('Error saving story project to database:', error);
    }
  }, [state]);

  const initializeProject = useCallback(
    async (projectId: string, title: string | null, initialSetup?: CreateStoryProjectRequest) => {
      try {
        const payload: CreateStoryProjectRequest = {
          project_id: projectId,
          title: title || undefined,
          story_mode: state.storyMode,
          story_template: state.storyTemplate,
          setup: initialSetup?.setup || {
            premise: state.premise,
            persona: state.persona,
            story_setting: state.storySetting,
            character_input: state.characters,
            plot_elements: state.plotElements,
            writing_style: state.writingStyle,
            story_tone: state.storyTone,
            narrative_pov: state.narrativePOV,
            audience_age_group: state.audienceAgeGroup,
            content_rating: state.contentRating,
            ending_preference: state.endingPreference,
            story_length: state.storyLength,
            enable_explainer: state.enableExplainer,
            enable_illustration: state.enableIllustration,
            enable_narration: state.enableNarration,
            enable_video_narration: state.enableVideoNarration,
          },
        };

        await storyWriterApi.createStoryProject(payload);
        setProjectMeta(projectId, title);
      } catch (error) {
        console.error('Error creating story project in database:', error);
        setProjectMeta(projectId, title);
      }
    },
    [state, setProjectMeta],
  );

  // Helper to get request object
  const getRequest = useCallback((): StoryGenerationRequest => {
    return {
      persona: state.persona,
      story_setting: state.storySetting,
      character_input: state.characters,
      plot_elements: state.plotElements,
      writing_style: state.writingStyle,
      story_tone: state.storyTone,
      narrative_pov: state.narrativePOV,
      audience_age_group: state.audienceAgeGroup,
      content_rating: state.contentRating,
      ending_preference: state.endingPreference,
      story_length: state.storyLength,
      enable_explainer: state.enableExplainer,
      enable_illustration: state.enableIllustration,
      enable_narration: state.enableNarration,
      enable_video_narration: state.enableVideoNarration,
      // Image generation settings
      image_provider: state.imageProvider || undefined,
      image_width: state.imageWidth,
      image_height: state.imageHeight,
      image_model: state.imageModel || undefined,
      // Video generation settings
      video_fps: state.videoFps,
      video_transition_duration: state.videoTransitionDuration,
      // Audio generation settings
      audio_provider: state.audioProvider,
      audio_lang: state.audioLang,
      audio_slow: state.audioSlow,
      audio_rate: state.audioRate,
      anime_bible: state.animeBible || null,
    };
  }, [state]);

  // Reset state
  const resetState = useCallback(() => {
    setState(DEFAULT_STATE as StoryWriterState);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('story_writer_state');
        localStorage.removeItem('storywriter_current_phase');
        localStorage.removeItem('storywriter_user_selected_phase');
      }
    } catch (error) {
      console.error('Error clearing story studio state from localStorage:', error);
    }
  }, []);

  return {
    ...state,
    setStoryMode,
    setStoryTemplate,
    setAnimeBible,
    setPersona,
    setStorySetting,
    setCharacters,
    setPlotElements,
    setWritingStyle,
    setStoryTone,
    setNarrativePOV,
    setAudienceAgeGroup,
    setContentRating,
    setEndingPreference,
    setStoryLength,
    setEnableExplainer,
    setEnableIllustration,
    setEnableNarration,
    setEnableVideoNarration,
    setImageProvider,
    setImageWidth,
    setImageHeight,
    setImageModel,
    setVideoFps,
    setVideoTransitionDuration,
    setAudioProvider,
    setAudioLang,
    setAudioSlow,
    setAudioRate,
    setPremise,
    setOutline,
    setOutlineScenes,
    setIsOutlineStructured,
    setStoryContent,
    setIsComplete,
    setSceneImages,
    setSceneAudio,
    setStoryVideo,
    setSceneHdVideos,
    setSceneAnimatedVideos,
    setSceneAnimationResumables,
    setHdVideoGenerationStatus,
    setCurrentHdSceneIndex,
    setCurrentTaskId,
    setGenerationProgress,
    setGenerationMessage,
    setIsLoading,
    setError,

    setAutoGenerateOnWriting,

    // Helpers
    getRequest,
    resetState,
    setProjectMeta,
    loadProjectFromDb,
    saveProjectToDb,
    initializeProject,
  };
};
