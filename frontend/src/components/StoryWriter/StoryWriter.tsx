import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, useTheme, Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import { useStoryWriterState } from '../../hooks/useStoryWriterState';
import { useStoryWriterPhaseNavigation } from '../../hooks/useStoryWriterPhaseNavigation';
import StorySetup from './Phases/StorySetup';
import StoryOutline from './Phases/StoryOutline';
import StoryWriting from './Phases/StoryWriting';
import StoryExport from './Phases/StoryExport';
import { StoryWriterHeader } from './StoryWriterHeader';
import { storyWriterApi } from '../../services/storyWriterApi';
import { triggerSubscriptionError } from '../../api/client';
import CloseIcon from '@mui/icons-material/Close';
import { MultimediaSection } from './components/MultimediaSection';
import { AnimeBibleDialog } from './components/AnimeBibleDialog';
import AutoSaveIndicator, { SaveStatus } from './components/AutoSaveIndicator';
import StoryWriterLanding from './StoryWriterLanding';
import { AIStorySetupModal } from './Phases/StorySetup/AIStorySetupModal';
import ComponentErrorBoundary from '../shared/ComponentErrorBoundary';
import { useLocation, useNavigate } from 'react-router-dom';

const createStoryProjectId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `story_${crypto.randomUUID()}`;
  }
  return `story_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
};

export const StoryWriter: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // State management
  const state = useStoryWriterState();

  // Multimedia generation state
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isMultimediaDialogOpen, setIsMultimediaDialogOpen] = useState(false);
  const [landingDismissed, setLandingDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('storywriter:landingDismissed') === 'true';
  });

  const [autoOpenSetupModal, setAutoOpenSetupModal] = useState(false);
  const [isLandingSetupModalOpen, setIsLandingSetupModalOpen] = useState(false);
  const [landingSetupMode, setLandingSetupMode] = useState<'marketing' | 'pure' | null>(null);
  const [landingSetupTemplate, setLandingSetupTemplate] = useState<string | null>(null);
  const [landingCustomWritingStyles, setLandingCustomWritingStyles] = useState<string[]>([]);
  const [landingCustomStoryTones, setLandingCustomStoryTones] = useState<string[]>([]);
  const [landingCustomNarrativePOVs, setLandingCustomNarrativePOVs] = useState<string[]>([]);
  const [landingCustomAudienceAgeGroups, setLandingCustomAudienceAgeGroups] = useState<string[]>([]);
  const [landingCustomContentRatings, setLandingCustomContentRatings] = useState<string[]>([]);
  const [landingCustomEndingPreferences, setLandingCustomEndingPreferences] = useState<string[]>([]);
  const [isDirectorOpen, setIsDirectorOpen] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const navState = location.state as { projectId?: string } | null;
    const incomingProjectId = navState?.projectId;
    if (incomingProjectId) {
      state.loadProjectFromDb(incomingProjectId).catch((error: any) => {
        console.error('Failed to load story project:', error);
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, state, navigate]);

  // Phase navigation
  const {
    phases,
    currentPhase,
    navigateToPhase,
  } = useStoryWriterPhaseNavigation({
    hasPremise: !!state.premise,
    hasOutline: !!state.outline,
    hasStoryContent: !!state.storyContent,
    isComplete: state.isComplete,
  });

  // Reset handler

  const handleReset = () => {
    // Reset story state (this also clears localStorage)
    state.resetState();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('storywriter:landingDismissed');
    }
    // Simplest approach: reload the page to ensure a clean slate
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleOpenMultimediaDialog = () => {
    setIsMultimediaDialogOpen(true);
  };

  const handleCloseMultimediaDialog = () => {
    setIsMultimediaDialogOpen(false);
  };

  // Audio generation handler
  const handleGenerateAudio = async () => {
    if (!state.enableNarration) {
      return;
    }
    if (!state.outlineScenes || state.outlineScenes.length === 0) {
      return;
    }

    setIsGeneratingAudio(true);

    try {
      const response = await storyWriterApi.generateSceneAudio({
        scenes: state.outlineScenes,
        provider: state.audioProvider,
        lang: state.audioLang,
        slow: state.audioSlow,
        rate: state.audioRate,
      });

      if (response.success && response.audio_files) {
        const audioMap = new Map<number, string>();
        response.audio_files.forEach((audio) => {
          if (audio.audio_url && !audio.error) {
            audioMap.set(audio.scene_number, audio.audio_url);
          }
        });
        state.setSceneAudio(audioMap);
        state.setError(null);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || status === 402) {
        await triggerSubscriptionError(err);
      }
      console.error('Audio generation failed:', err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Video generation handler
  const handleGenerateVideo = async () => {
    if (!state.enableVideoNarration) {
      return;
    }
    if (!state.outlineScenes || state.outlineScenes.length === 0) {
      return;
    }

    if (!state.sceneImages || state.sceneImages.size === 0) {
      return;
    }

    if (!state.sceneAudio || state.sceneAudio.size === 0) {
      return;
    }

    setIsGeneratingVideo(true);

    try {
      const imageUrls: (string | null)[] = [];
      const audioUrls: string[] = [];
      const scenes = state.outlineScenes;

      const videoUrls: (string | null)[] = [];

      for (const scene of scenes) {
        const sceneNumber = scene.scene_number || scenes.indexOf(scene) + 1;
        const imageUrl = state.sceneImages?.get(sceneNumber);
        const audioUrl = state.sceneAudio?.get(sceneNumber);
        const animatedVideoUrl = state.sceneAnimatedVideos?.get(sceneNumber);

        if (!audioUrl) {
          continue; // Skip scenes without audio
        }

        // Prefer animated video if available, otherwise use image
        if (animatedVideoUrl) {
          videoUrls.push(animatedVideoUrl);
          imageUrls.push(null);
        } else if (imageUrl) {
          videoUrls.push(null);
          imageUrls.push(imageUrl);
        } else {
          continue; // Skip scenes without image or video
        }

        audioUrls.push(audioUrl);
      }

      if (imageUrls.length !== scenes.length || audioUrls.length !== scenes.length) {
        throw new Error('Number of images/videos and audio files must match number of scenes');
      }

      // Switch to async flow so UI can poll progress messages
      const start = await storyWriterApi.generateStoryVideoAsync({
        scenes: scenes,
        image_urls: imageUrls,
        audio_urls: audioUrls,
        video_urls: videoUrls.length > 0 ? videoUrls : undefined,
        ai_audio_urls: undefined, // TODO: Track AI audio separately in state
        story_title: state.storySetting || 'Story',
        fps: state.videoFps,
        transition_duration: state.videoTransitionDuration,
      });

      // Optional: set a lightweight spinner; export page shows detailed progress
      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1200));
        const status = await storyWriterApi.getTaskStatus(start.task_id);
        if (status.status === 'completed') {
          const result = await storyWriterApi.getTaskResult(start.task_id);
          // @ts-ignore: async result includes video dict
          const video = (result as any).video || (result as any)?.result?.video;
          const finalUrl: string | undefined = video?.video_url;
          if (finalUrl) state.setStoryVideo(finalUrl);
          state.setError(null);
          done = true;
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Video generation failed');
        }
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || status === 402) {
        await triggerSubscriptionError(err);
      }
      console.error('Video generation failed:', err);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const hasStoryProgress = Boolean(state.premise || state.outline || state.storyContent);
  const showLanding = !landingDismissed && !hasStoryProgress;
  const hasAnimeBible = Boolean(state.animeBible);
  const canSaveProject = Boolean(
    state.premise || state.outline || state.outlineScenes || state.storyContent,
  );

  const handleSaveProject = async () => {
    if (isSavingProject) {
      return;
    }
    if (!canSaveProject) {
      return;
    }
    setIsSavingProject(true);
    setSaveStatus('saving');
    try {
      if (!state.projectId) {
        const projectId = createStoryProjectId();
        const title =
          state.projectTitle ||
          (state.premise && state.premise.trim().length > 0
            ? state.premise.trim().slice(0, 80)
            : 'Untitled Story');
        await state.initializeProject(projectId, title);
        await state.saveProjectToDb(projectId);
      } else {
        await state.saveProjectToDb();
      }
      setSaveStatus('saved');
      setLastSavedAt(new Date());
    } catch (err) {
      setSaveStatus('error');
      console.error('Failed to save project:', err);
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleLandingStart = () => {
    setLandingDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('storywriter:landingDismissed', 'true');
    }
    navigateToPhase('setup');
  };

  const handleLandingSelectPath = (
    mode: 'marketing' | 'pure',
    template:
      | 'product_story'
      | 'brand_manifesto'
      | 'founder_story'
      | 'customer_story'
      | 'short_fiction'
      | 'long_fiction'
      | 'anime_fiction'
      | 'experimental_fiction'
      | null,
  ) => {
    state.setStoryMode(mode);
    if (
      mode === 'marketing' &&
      (template === 'product_story' ||
        template === 'brand_manifesto' ||
        template === 'founder_story' ||
        template === 'customer_story')
    ) {
      state.setStoryTemplate(template);
    } else {
      state.setStoryTemplate(null);
    }
    setLandingSetupMode(mode);
    setLandingSetupTemplate(template);
    setIsLandingSetupModalOpen(true);
  };

  // Render phase content
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'setup':
        return (
          <ComponentErrorBoundary componentName="Story Setup">
            <StorySetup state={state} onNext={() => navigateToPhase('outline')} />
          </ComponentErrorBoundary>
        );
      case 'outline':
        return (
          <ComponentErrorBoundary componentName="Story Outline">
            <StoryOutline state={state} onNext={() => navigateToPhase('writing')} />
          </ComponentErrorBoundary>
        );
      case 'writing':
        return (
          <ComponentErrorBoundary componentName="Story Writing">
            <StoryWriting state={state} onNext={() => navigateToPhase('export')} onPrev={() => navigateToPhase('outline')} />
          </ComponentErrorBoundary>
        );
      case 'export':
        return (
          <ComponentErrorBoundary componentName="Story Export">
            <StoryExport
              state={state}
              onSaveProject={handleSaveProject}
              isSavingProject={isSavingProject}
            />
          </ComponentErrorBoundary>
        );
      default:
        return (
          <ComponentErrorBoundary componentName="Story Setup">
            <StorySetup state={state} onNext={() => navigateToPhase('outline')} />
          </ComponentErrorBoundary>
        );
    }
  };

  if (showLanding) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          padding: theme.spacing(4),
        }}
      >
        <Container maxWidth="xl">
          <StoryWriterLanding onStart={handleLandingStart} onSelectPath={handleLandingSelectPath} />
          <AIStorySetupModal
            open={isLandingSetupModalOpen}
            onClose={() => setIsLandingSetupModalOpen(false)}
            state={state}
            customValuesSetters={{
              setCustomWritingStyles: setLandingCustomWritingStyles,
              setCustomStoryTones: setLandingCustomStoryTones,
              setCustomNarrativePOVs: setLandingCustomNarrativePOVs,
              setCustomAudienceAgeGroups: setLandingCustomAudienceAgeGroups,
              setCustomContentRatings: setLandingCustomContentRatings,
              setCustomEndingPreferences: setLandingCustomEndingPreferences,
            }}
            originMode={landingSetupMode}
            originTemplate={landingSetupTemplate}
            onApplied={() => {
              setLandingDismissed(true);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('storywriter:landingDismissed', 'true');
              }
              navigateToPhase('setup');
            }}
          />
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        padding: theme.spacing(2, 4, 3),
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.03"%3E%3Ccircle cx="40" cy="40" r="3"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 0,
        },
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header with cream theme card + Phase Navigation + UserBadge */}
        <Box sx={{ mb: 2, pt: 1 }}>
          <StoryWriterHeader
            onReset={handleReset}
            phases={phases}
            currentPhase={currentPhase}
            onPhaseClick={navigateToPhase}
            hasAnimeBible={hasAnimeBible}
            onDirectorOpen={() => setIsDirectorOpen(true)}
            isSavingProject={isSavingProject}
            canSaveProject={canSaveProject}
            onSaveProject={handleSaveProject}
            state={state}
            onGenerateAudio={handleGenerateAudio}
            onGenerateVideo={handleGenerateVideo}
            isGeneratingAudio={isGeneratingAudio}
            isGeneratingVideo={isGeneratingVideo}
            onOpenPanel={(_section) => handleOpenMultimediaDialog()}
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
          />
        </Box>

        {/* Phase Content */}
        <Box sx={{ mt: 2 }}>
          {renderPhaseContent()}
        </Box>
      </Container>

      <Dialog
        open={isMultimediaDialogOpen}
        onClose={handleCloseMultimediaDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Multimedia Controls
          <IconButton size="small" onClick={handleCloseMultimediaDialog}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <ComponentErrorBoundary componentName="Multimedia Controls">
            <MultimediaSection state={state} />
          </ComponentErrorBoundary>
        </DialogContent>
      </Dialog>
      <AnimeBibleDialog
        open={isDirectorOpen}
        onClose={() => setIsDirectorOpen(false)}
        animeBible={state.animeBible}
        onSave={(bible) => state.setAnimeBible(bible)}
      />
    </Box>
  );
};

export default StoryWriter;
