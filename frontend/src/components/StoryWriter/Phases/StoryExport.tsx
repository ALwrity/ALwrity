import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  Divider,
  CircularProgress,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import ImageIcon from '@mui/icons-material/Image';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useStoryWriterState } from '../../../hooks/useStoryWriterState';
import { storyWriterApi } from '../../../services/storyWriterApi';
import { fetchMediaBlobUrl, downloadMediaBlob } from '../../../utils/fetchMediaBlobUrl';
import { renderMarkdown } from '../../../utils/markdown';
import GlobalStyles from '@mui/material/GlobalStyles';
import { triggerSubscriptionError } from '../../../api/client';
import SmartDisplayIcon from '@mui/icons-material/SmartDisplay';
import SceneVideoApproval from '../components/SceneVideoApproval';
import { PrimaryButton } from '../../PodcastMaker/ui/PrimaryButton';
import { StoryVideoProgressModal } from './StorySetup/StoryVideoProgressModal';

interface StoryExportProps {
  state: ReturnType<typeof useStoryWriterState>;
  onSaveProject?: () => void;
  isSavingProject?: boolean;
}

const splitStoryContent = (content: string, numSections: number): string[] => {
  if (!content || numSections <= 1) {
    return [content || ''];
  }
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) {
    return [content];
  }
  if (paragraphs.length <= numSections) {
    const sections = [...paragraphs];
    while (sections.length < numSections) {
      sections.push('');
    }
    return sections;
  }
  const sections: string[] = [];
  const paragraphsPerSection = Math.ceil(paragraphs.length / numSections);
  for (let i = 0; i < numSections; i++) {
    const start = i * paragraphsPerSection;
    const end = Math.min(start + paragraphsPerSection, paragraphs.length);
    sections.push(paragraphs.slice(start, end).join('\n\n'));
  }
  return sections;
};

const StoryExport: React.FC<StoryExportProps> = ({ state, onSaveProject, isSavingProject }) => {
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoMessage, setVideoMessage] = useState<string>('');
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [isGeneratingHdVideo, setIsGeneratingHdVideo] = useState(false);
  const [hdVideoProgress, setHdVideoProgress] = useState(0);
  const [hdVideoMessage, setHdVideoMessage] = useState<string>('');
  const [hdVideoPrompts, setHdVideoPrompts] = useState<Map<number, string>>(new Map()); // Store prompts by scene number
  const [isExportingPackage, setIsExportingPackage] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [sceneImageBlobUrls, setSceneImageBlobUrls] = useState<Map<number, string | null>>(new Map());
  const [sceneAudioBlobUrls, setSceneAudioBlobUrls] = useState<Map<number, string | null>>(new Map());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load blob URLs for generated scene images and audio so they can be
  // previewed and downloaded in the export phase (authenticated assets).
  useEffect(() => {
    const loadMedia = async () => {
      const imageMap = new Map<number, string | null>();
      const audioMap = new Map<number, string | null>();

      if (state.outlineScenes) {
        for (const scene of state.outlineScenes) {
          const sceneNumber = scene.scene_number || state.outlineScenes.indexOf(scene) + 1;
          const imageUrl = state.sceneImages?.get(sceneNumber);
          const audioUrl = state.sceneAudio?.get(sceneNumber);
          if (imageUrl) {
            imageMap.set(sceneNumber, await fetchMediaBlobUrl(imageUrl));
          }
          if (audioUrl) {
            audioMap.set(sceneNumber, await fetchMediaBlobUrl(audioUrl));
          }
        }
      }

      setSceneImageBlobUrls(imageMap);
      setSceneAudioBlobUrls(audioMap);
    };

    loadMedia();
  }, [state.outlineScenes, state.sceneImages, state.sceneAudio]);
  const [error, setError] = useState<string | null>(null);

  // Split story content into sections matching scene count for inline image display
  const storySections = useMemo(() => {
    const hasScenes = state.outlineScenes && state.outlineScenes.length > 0;
    if (!hasScenes || !state.storyContent) return null;
    return splitStoryContent(state.storyContent, state.outlineScenes!.length);
  }, [state.storyContent, state.outlineScenes]);

  // Scene-by-scene approval state
  const [approvalModal, setApprovalModal] = useState<{
    open: boolean;
    sceneNumber: number;
    sceneTitle: string;
    videoUrl: string;
    promptUsed: string;
  } | null>(null);
  const [regeneratingScene, setRegeneratingScene] = useState<number | null>(null);
  
  // Keep track of the processing function for continuation
  const processSceneRef = useRef<((sceneIndex: number) => Promise<void>) | null>(null);

  const handleCopyToClipboard = () => {
    if (state.storyContent) {
      navigator.clipboard.writeText(state.storyContent);
    }
  };

  const handleDownload = () => {
    if (state.storyContent) {
      const blob = new Blob([state.storyContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `story-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const buildExportPayload = () => {
    const sceneImages: Record<string, string> = {};
    const sceneAudio: Record<string, string> = {};
    state.sceneImages?.forEach((url, sceneNumber) => {
      sceneImages[String(sceneNumber)] = url;
    });
    state.sceneAudio?.forEach((url, sceneNumber) => {
      sceneAudio[String(sceneNumber)] = url;
    });

    return {
      story_title: state.projectTitle || state.premise?.slice(0, 80) || 'My Story',
      story_setup: {
        genre: state.storyMode,
        writing_style: state.writingStyle,
        story_tone: state.storyTone,
        narrative_pov: state.narrativePOV,
        audience_age_group: state.audienceAgeGroup,
        content_rating: state.contentRating,
        ending_preference: state.endingPreference,
        story_length: state.storyLength,
        story_setting: state.storySetting,
        character_input: state.characters,
        plot_elements: state.plotElements,
      },
      outline: state.outlineScenes || state.outline,
      story_content: state.storyContent!,
      scene_media: { scene_images: sceneImages, scene_audio: sceneAudio },
      story_video: state.storyVideo || null,
    };
  };

  const handleDownloadPackage = async () => {
    if (!state.storyContent) return;
    setIsExportingPackage(true);
    setError(null);
    try {
      const response = await storyWriterApi.exportStoryPackage(buildExportPayload());
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `story-package-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      state.setError(null);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to export story package';
      setError(message);
      state.setError(message);
    } finally {
      setIsExportingPackage(false);
    }
  };

  const handleExportPdf = async () => {
    if (!state.storyContent) return;
    setIsExportingPdf(true);
    setError(null);
    try {
      const response = await storyWriterApi.exportStoryPdf(buildExportPayload());
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `story-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      state.setError(null);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to export PDF';
      setError(message);
      state.setError(message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!state.enableVideoNarration) {
      setError('Story video generation is disabled in Story Setup.');
      return;
    }
    if (!state.outlineScenes || state.outlineScenes.length === 0) {
      setError('Please generate a structured outline first');
      return;
    }

    if (!state.sceneImages || state.sceneImages.size === 0) {
      setError('Please generate images for scenes first');
      return;
    }

    if (!state.sceneAudio || state.sceneAudio.size === 0) {
      setError('Please generate audio for scenes first');
      return;
    }

    setIsGeneratingVideo(true);
    setError(null);
    setVideoProgress(0);

    try {
      // Prepare image and audio URLs in scene order
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
          throw new Error(`Missing audio for scene ${sceneNumber}`);
        }

        // Prefer animated video if available, otherwise use image
        if (animatedVideoUrl) {
          videoUrls.push(animatedVideoUrl);
          imageUrls.push(null);
        } else if (imageUrl) {
          videoUrls.push(null);
          imageUrls.push(imageUrl);
        } else {
          throw new Error(`Missing image or animated video for scene ${sceneNumber}`);
        }

        audioUrls.push(audioUrl);
      }

      if (imageUrls.length !== scenes.length || audioUrls.length !== scenes.length) {
        throw new Error('Number of images/videos and audio files must match number of scenes');
      }

      // Start async video generation
      const startRes = await storyWriterApi.generateStoryVideoAsync({
        scenes: scenes,
        image_urls: imageUrls,
        audio_urls: audioUrls,
        video_urls: videoUrls.length > 0 ? videoUrls : undefined,
        ai_audio_urls: undefined, // TODO: Track AI audio separately in state
        story_title: state.storySetting || 'Story',
        fps: state.videoFps,
        transition_duration: state.videoTransitionDuration,
      });

      // Poll task status
      const taskId = startRes.task_id;
      setVideoMessage(startRes.message || 'Starting video generation...');

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1200));
        const status = await storyWriterApi.getTaskStatus(taskId);
        setVideoProgress(Math.round(status.progress ?? 0));
        if (status.message) setVideoMessage(status.message);
        if (status.status === 'completed') {
          done = true;
          const result = await storyWriterApi.getTaskResult(taskId);
          // result.video exists under result.video
          // @ts-ignore – result typing is StoryFullGenerationResponse; our async returns a dict
          const video = result.video || (result as any).video;
          const videoUrl = video?.video_url;
          if (!videoUrl) throw new Error('Video URL missing in result');
          state.setStoryVideo(videoUrl);
          // fetch blob for authenticated preview
          const blobUrl = await fetchMediaBlobUrl(videoUrl);
          if (blobUrl) {
            setVideoBlobUrl(blobUrl);
          } else {
            setVideoBlobUrl(null);
          }
          setVideoProgress(100);
          setVideoMessage('Video generation complete');
        state.setError(null);
          // Autoplay and fullscreen
          setTimeout(() => {
            const v = videoRef.current;
            if (v) {
              try { v.play().catch(() => {}); } catch {}
              try { if (v.requestFullscreen) v.requestFullscreen(); } catch {}
            }
          }, 300);
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Video generation failed');
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate video';
      setError(errorMessage);
      state.setError(errorMessage);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (state.storyVideo) {
      await downloadMediaBlob(state.storyVideo, `story-video-${Date.now()}.mp4`);
    }
  };

  const handleGenerateHdVideo = async () => {
    if (!state.outlineScenes || state.outlineScenes.length === 0) {
      setError('Please generate a structured outline first');
      return;
    }

    const scenes = state.outlineScenes;
    const totalScenes = scenes.length;
    
    // Initialize HD videos map if not exists
    if (!state.sceneHdVideos) {
      state.setSceneHdVideos(new Map());
    }
    
    // Clear previous prompts
    setHdVideoPrompts(new Map());
    
    state.setHdVideoGenerationStatus('generating');
    setIsGeneratingHdVideo(true);
    setError(null);

    // Build story context for prompt enhancement
    const storyContext = {
      persona: state.persona,
      story_setting: state.storySetting,
      characters: state.characters,
      plot_elements: state.plotElements,
      writing_style: state.writingStyle,
      story_tone: state.storyTone,
      narrative_pov: state.narrativePOV,
      audience_age_group: state.audienceAgeGroup,
      content_rating: state.contentRating,
      premise: state.premise || '',
      outline: state.outline || '',
      story_content: state.storyContent || '',
    };

    // Iterate through scenes one at a time
    const processScene = async (sceneIndex: number): Promise<void> => {
      if (sceneIndex >= totalScenes) {
        // All scenes processed
        state.setHdVideoGenerationStatus('completed');
        setIsGeneratingHdVideo(false);
        setHdVideoProgress(100);
        setHdVideoMessage(`All ${totalScenes} scenes processed`);
        
        // Show completion message
        const approvedCount = state.sceneHdVideos?.size || 0;
        setHdVideoMessage(`HD video generation complete! ${approvedCount} of ${totalScenes} scenes approved.`);
        return;
      }

      const scene = scenes[sceneIndex];
      const sceneNumber = scene.scene_number || sceneIndex + 1;
      state.setCurrentHdSceneIndex(sceneIndex);
      
      setHdVideoProgress(Math.round((sceneIndex / totalScenes) * 100));
      setHdVideoMessage(`Generating HD video for Scene ${sceneNumber}...`);

      try {
        // Generate video for current scene
        const result = await storyWriterApi.generateHdVideoScene({
          scene_number: sceneNumber,
          scene_data: scene,
          story_context: storyContext,
          all_scenes: scenes,
          provider: 'huggingface',
          model: 'tencent/HunyuanVideo',
          num_frames: 50,
          guidance_scale: 7.5,
        });

        // Store prompt for this scene
        setHdVideoPrompts((prev) => {
          const newPrompts = new Map(prev);
          newPrompts.set(sceneNumber, result.prompt_used);
          return newPrompts;
        });

        // Show approval modal
        state.setHdVideoGenerationStatus('awaiting_approval');
        setApprovalModal({
          open: true,
          sceneNumber: sceneNumber,
          sceneTitle: scene.title || `Scene ${sceneNumber}`,
          videoUrl: result.video_url,
          promptUsed: result.prompt_used,
        });

      } catch (err: any) {
        // Check if this is a subscription error (429/402) and trigger global subscription modal
        const status = err?.response?.status;
        if (status === 429 || status === 402) {
          const handled = await triggerSubscriptionError(err);
          if (handled) {
            // Subscription modal is showing, stop processing scenes
            setIsGeneratingHdVideo(false);
            state.setHdVideoGenerationStatus('idle');
            return;
          }
        }
        
        const errorMessage = err.response?.data?.detail || err.message || `Failed to generate HD video for scene ${sceneNumber}`;
        setError(errorMessage);
        
        // On subscription error, stop processing. On other errors, continue to next scene.
        if (status !== 429 && status !== 402) {
          await processScene(sceneIndex + 1);
        } else {
          setIsGeneratingHdVideo(false);
          state.setHdVideoGenerationStatus('idle');
        }
      }
    };

    // Store processScene function in ref for continuation
    processSceneRef.current = processScene;
    
    // Start processing first scene
    await processScene(0);
  };

  // Handle approval modal actions
  const handleApprove = () => {
    if (!approvalModal) return;
    
    const sceneNumber = approvalModal.sceneNumber;
    const hdVideos = state.sceneHdVideos || new Map();
    hdVideos.set(sceneNumber, approvalModal.videoUrl);
    state.setSceneHdVideos(new Map(hdVideos));
    
    setApprovalModal(null);
    
    // Continue to next scene
    const currentIndex = state.currentHdSceneIndex;
    const scenes = state.outlineScenes || [];
    if (currentIndex + 1 < scenes.length && processSceneRef.current) {
      state.setHdVideoGenerationStatus('generating');
      processSceneRef.current(currentIndex + 1);
    } else {
      state.setHdVideoGenerationStatus('completed');
      setIsGeneratingHdVideo(false);
      const approvedCount = state.sceneHdVideos?.size || 0;
      setHdVideoMessage(`HD video generation complete! ${approvedCount} of ${scenes.length} scenes approved.`);
    }
  };

  const handleReject = () => {
    if (!approvalModal) return;
    
    // Skip scene and continue to next
    setApprovalModal(null);
    
    const currentIndex = state.currentHdSceneIndex;
    const scenes = state.outlineScenes || [];
    if (currentIndex + 1 < scenes.length && processSceneRef.current) {
      state.setHdVideoGenerationStatus('generating');
      processSceneRef.current(currentIndex + 1);
    } else {
      state.setHdVideoGenerationStatus('completed');
      setIsGeneratingHdVideo(false);
      const approvedCount = state.sceneHdVideos?.size || 0;
      setHdVideoMessage(`HD video generation complete! ${approvedCount} of ${scenes.length} scenes approved.`);
    }
  };

  const handleRegenerate = async () => {
    if (!approvalModal) return;
    
    const sceneNumber = approvalModal.sceneNumber;
    const scenes = state.outlineScenes || [];
    const sceneIndex = scenes.findIndex((s: any) => (s.scene_number || 0) === sceneNumber);
    const scene = scenes[sceneIndex];
    
    if (!scene) return;
    
    setRegeneratingScene(sceneNumber);
    
    try {
      const storyContext = {
        persona: state.persona,
        story_setting: state.storySetting,
        characters: state.characters,
        plot_elements: state.plotElements,
        writing_style: state.writingStyle,
        story_tone: state.storyTone,
        narrative_pov: state.narrativePOV,
        audience_age_group: state.audienceAgeGroup,
        content_rating: state.contentRating,
        premise: state.premise || '',
        outline: state.outline || '',
        story_content: state.storyContent || '',
      };

      const result = await storyWriterApi.generateHdVideoScene({
        scene_number: sceneNumber,
        scene_data: scene,
        story_context: storyContext,
        all_scenes: scenes,
        provider: 'huggingface',
        model: 'tencent/HunyuanVideo',
        num_frames: 50,
        guidance_scale: 7.5,
      });

      // Update prompt for this scene
      setHdVideoPrompts((prev) => {
        const newPrompts = new Map(prev);
        newPrompts.set(sceneNumber, result.prompt_used);
        return newPrompts;
      });

      // Update approval modal with new video
      setApprovalModal({
        open: true,
        sceneNumber: sceneNumber,
        sceneTitle: scene.title || `Scene ${sceneNumber}`,
        videoUrl: result.video_url,
        promptUsed: result.prompt_used,
      });
    } catch (err: any) {
      // Check if this is a subscription error (429/402) and trigger global subscription modal
      const status = err?.response?.status;
      if (status === 429 || status === 402) {
        const handled = await triggerSubscriptionError(err);
        if (handled) {
          // Subscription modal is showing, stop here
          setRegeneratingScene(null);
          return;
        }
      }
      
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to regenerate video';
      setError(errorMessage);
    } finally {
      setRegeneratingScene(null);
    }
  };

  return (
    <>
    <Paper 
      sx={{ 
        p: 4, 
        mt: 2,
        backgroundColor: '#F7F3E9',
        color: '#2C2416',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <GlobalStyles
        styles={{
          '.rendered-content p': { marginBottom: '0.75rem', lineHeight: 1.8 },
          '.rendered-content h1, .rendered-content h2, .rendered-content h3': {
            color: '#2C2416', marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600,
          },
          '.rendered-content h1': { fontSize: '1.5rem' },
          '.rendered-content h2': { fontSize: '1.3rem', borderBottom: '1px solid rgba(120,90,60,0.2)', paddingBottom: '0.25rem' },
          '.rendered-content h3': { fontSize: '1.15rem' },
          '.rendered-content strong': { fontWeight: 700 },
          '.rendered-content em': { fontStyle: 'italic' },
          '.rendered-content ul, .rendered-content ol': { paddingLeft: '1.5rem', marginBottom: '0.75rem' },
          '.rendered-content li': { marginBottom: '0.25rem' },
          '.rendered-content blockquote': {
            borderLeft: '3px solid #8D6E63', paddingLeft: '1rem', color: '#5D4037',
            fontStyle: 'italic', margin: '0.75rem 0',
          },
          '.rendered-content code': {
            background: 'rgba(141,110,99,0.12)', padding: '2px 6px', borderRadius: 4,
            fontFamily: 'monospace', fontSize: '0.9em',
          },
          '.rendered-content hr': { border: 'none', borderTop: '1px solid rgba(120,90,60,0.2)', margin: '1rem 0' },
          '.rendered-content a': { color: '#5D4037', textDecoration: 'underline' },
          '.rendered-content img': { maxWidth: '100%', height: 'auto', borderRadius: '4px', margin: '0.5rem 0' },
        }}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h5" gutterBottom sx={{ mb: 0.5, fontWeight: 600, color: '#1A1611' }}>
            Export Story
          </Typography>
          <Typography variant="body2" sx={{ color: '#5D4037' }}>
            Your story is complete! Copy, download, or package it for sharing.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          {onSaveProject && (
            <PrimaryButton
              onClick={onSaveProject}
              startIcon={<SaveIcon />}
              loading={Boolean(isSavingProject)}
              ariaLabel="Save story project"
              tooltip={
                state.projectId
                  ? 'Save changes to My Projects'
                  : 'Save this story to My Projects'
              }
              sx={{ minWidth: 160 }}
            >
              {state.projectId ? 'Save to My Projects' : 'Save Story'}
            </PrimaryButton>
          )}
          <Button variant="outlined" onClick={handleCopyToClipboard} size="small">
            Copy Text
          </Button>
          <Button variant="outlined" onClick={handleDownload} startIcon={<DownloadIcon />} size="small">
            Text File
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderZipIcon />}
            onClick={handleDownloadPackage}
            disabled={isExportingPackage}
            size="small"
          >
            {isExportingPackage ? 'Packaging...' : 'Package'}
          </Button>
          <Button
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            size="small"
            sx={{
              background: 'linear-gradient(90deg, #5D4037, #3E2723)',
              color: '#FAF9F6',
              '&:hover': { background: 'linear-gradient(90deg, #3E2723, #2C2416)' },
            }}
          >
            {isExportingPdf ? 'Exporting...' : 'PDF'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!state.storyContent ? (
        <Alert severity="info">
          No story content available. Please complete the writing phase first.
        </Alert>
      ) : (
        <>
          {/* Story Summary */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1A1611' }}>
              Story Summary
            </Typography>
            <Box 
              sx={{ 
                p: 2, 
                borderRadius: 1,
                backgroundColor: '#FAF9F6', // Slightly lighter cream for summary box
              }}
            >
              <Typography variant="body2" sx={{ mb: 1, color: '#2C2416' }}>
                <strong>Setting:</strong> {state.storySetting || 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: '#2C2416' }}>
                <strong>Characters:</strong> {state.characters || 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: '#2C2416' }}>
                <strong>Style:</strong> {state.writingStyle} | <strong>Tone:</strong> {state.storyTone}
              </Typography>
              <Typography variant="body2" sx={{ color: '#2C2416' }}>
                <strong>POV:</strong> {state.narrativePOV} | <strong>Audience:</strong> {state.audienceAgeGroup}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Premise */}
          {state.premise && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#1A1611' }}>
                Premise
              </Typography>
              <Box
                className="rendered-content"
                sx={{
                  p: 2,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 1,
                  border: '1.5px solid #8D6E63',
                  color: '#1A1611',
                  lineHeight: 1.7,
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(state.premise || '') }}
              />
            </Box>
          )}

          {/* Outline */}
          {state.outline && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#1A1611' }}>
                Outline
              </Typography>
              <Box
                className="rendered-content"
                sx={{
                  p: 2,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 1,
                  border: '1.5px solid #8D6E63',
                  color: '#1A1611',
                  lineHeight: 1.7,
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(state.outline || '') }}
              />
            </Box>
          )}

          {/* Story Content */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1A1611' }}>
              Complete Story
            </Typography>
            {storySections && state.outlineScenes && state.outlineScenes.length > 0 ? (
              <Box>
                {state.outlineScenes.map((scene, idx) => {
                  const sectionText = storySections[idx];
                  if (!sectionText) return null;
                  const sceneNum = scene.scene_number || idx + 1;
                  const imageUrl = sceneImageBlobUrls.get(sceneNum);
                  const sceneTitle = scene.title || `Scene ${sceneNum}`;
                  return (
                    <Box
                      key={sceneNum}
                      sx={{
                        mb: 3,
                        p: 2.5,
                        backgroundColor: '#FAFAF5',
                        borderRadius: 2,
                        border: '1.5px solid #E8DDD0',
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          color: '#5D4037',
                          mb: 1.5,
                          fontSize: '1rem',
                        }}
                      >
                        {sceneTitle}
                      </Typography>
                      {imageUrl && (
                        <Box
                          sx={{
                            mb: 1.5,
                            borderRadius: 1,
                            overflow: 'hidden',
                            maxWidth: 480,
                          }}
                        >
                          <Box
                            component="img"
                            src={imageUrl}
                            alt={`${sceneTitle} illustration`}
                            sx={{
                              width: '100%',
                              height: 'auto',
                              display: 'block',
                              borderRadius: 1,
                            }}
                          />
                        </Box>
                      )}
                      <Box
                        className="rendered-content"
                        sx={{
                          color: '#3E2723',
                          lineHeight: 1.7,
                          fontSize: '0.95rem',
                        }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(sectionText) }}
                      />
                    </Box>
                  );
                })}
              </Box>
            ) : state.storyContent ? (
              <Box
                className="rendered-content"
                sx={{
                  p: 2.5,
                  backgroundColor: '#FAFAF5',
                  borderRadius: 2,
                  border: '1.5px solid #E8DDD0',
                  color: '#3E2723',
                  lineHeight: 1.7,
                  fontSize: '0.95rem',
                  minHeight: '400px',
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(state.storyContent || '') }}
              />
            ) : null}
          </Box>

          {/* Generated Media — Images & Audio */}
          {(state.sceneImages?.size || 0) > 0 || (state.sceneAudio?.size || 0) > 0 ? (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#1A1611' }}>
                Generated Media
              </Typography>
              <Typography variant="body2" sx={{ color: '#5D4037', mb: 2 }}>
                Scene images and audio narration generated during the writing phase.
              </Typography>

              {/* Images */}
              {(state.sceneImages?.size || 0) > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#5D4037', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ImageIcon fontSize="small" /> Scene Images
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                    {Array.from(sceneImageBlobUrls.entries()).map(([sceneNumber, blobUrl]) => {
                      return (
                        <Box
                          key={`img-${sceneNumber}`}
                          sx={{
                            border: '1px solid rgba(141,110,99,0.25)',
                            borderRadius: 2,
                            overflow: 'hidden',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          {blobUrl ? (
                            <img
                              src={blobUrl}
                              alt={`Scene ${sceneNumber}`}
                              style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                            />
                          ) : (
                            <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F7F3E9' }}>
                              <Typography variant="caption" sx={{ color: '#8D6E63' }}>
                                Image unavailable
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2C2416' }}>
                              Scene {sceneNumber}
                            </Typography>
                            {blobUrl && (
                              <Button
                                size="small"
                                variant="text"
                                href={blobUrl}
                                download={`scene-${sceneNumber}-image.png`}
                                sx={{ color: '#5D4037', minWidth: 'auto' }}
                              >
                                Download
                              </Button>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* Audio */}
              {(state.sceneAudio?.size || 0) > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#5D4037', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <VolumeUpIcon fontSize="small" /> Scene Audio
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {Array.from(sceneAudioBlobUrls.entries()).map(([sceneNumber, blobUrl]) => {
                      return (
                        <Box
                          key={`audio-${sceneNumber}`}
                          sx={{
                            p: 1.5,
                            border: '1px solid rgba(141,110,99,0.25)',
                            borderRadius: 2,
                            backgroundColor: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#2C2416', minWidth: 80 }}>
                            Scene {sceneNumber}
                          </Typography>
                          {blobUrl ? (
                            <>
                              <audio controls src={blobUrl} style={{ flex: 1, minWidth: 200 }} />
                              <Button
                                size="small"
                                variant="text"
                                href={blobUrl}
                                download={`scene-${sceneNumber}-audio.mp3`}
                                sx={{ color: '#5D4037', minWidth: 'auto' }}
                              >
                                Download
                              </Button>
                            </>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#8D6E63' }}>
                              Audio unavailable
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          ) : null}

          {/* Video Generation */}
          {state.isOutlineStructured && state.outlineScenes && (
            state.enableVideoNarration ? (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#1A1611' }}>
                Video Generation
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Generate a video from your story scenes with images and audio narration.
                {(!state.sceneImages || state.sceneImages.size === 0) && ' Generate images first.'}
                {(!state.sceneAudio || state.sceneAudio.size === 0) && ' Generate audio first.'}
              </Alert>
              
              <StoryVideoProgressModal
                open={isGeneratingVideo}
                progress={videoProgress}
                message={videoMessage || 'Generating video...'}
              />

              {state.storyVideo && (
                <Box sx={{ mb: 2 }}>
                  <video
                    ref={videoRef}
                    controls
                    src={videoBlobUrl ?? undefined}
                    style={{ width: '100%', maxHeight: '500px' }}
                  >
                    Your browser does not support the video element.
                  </video>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#5D4037' }}>
                    Generated story video
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <Tooltip
                      title={
                        <Box sx={{ p: 1 }}>
                          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                            Generate HD Animation with AI
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                            Upgrade this storyboard into a high‑definition AI animation using Hugging Face text‑to‑video models.
                            Your draft was generated affordably (images + narration). This premium option uses an AI model to render motion.
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                            Recommended models:
                          </Typography>
                          <Typography variant="caption" component="div" sx={{ display: 'block', mb: 1 }}>
                            • tencent/HunyuanVideo<br />
                            • Lightricks/LTX-Video<br />
                            • Lightricks/LTX-Video-0.9.8-13B-distilled
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic' }}>
                            This will generate HD videos for each scene one at a time. You'll review and approve each scene before the next one is generated.
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <Button
                        variant="contained"
                        startIcon={<SmartDisplayIcon />}
                        onClick={handleGenerateHdVideo}
                        disabled={isGeneratingHdVideo || state.hdVideoGenerationStatus === 'awaiting_approval'}
                      >
                        {isGeneratingHdVideo || state.hdVideoGenerationStatus === 'awaiting_approval' 
                          ? 'Generating HD Animation...' 
                          : 'Generate HD Animation with AI'}
                      </Button>
                    </Tooltip>
                    
                    {/* Show progress and prompts during generation */}
                    {(isGeneratingHdVideo || state.hdVideoGenerationStatus === 'generating' || state.hdVideoGenerationStatus === 'awaiting_approval') && (
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#FAF9F6', borderRadius: 1, border: '1px solid #E0DCD4' }}>
                        <LinearProgress variant="determinate" value={hdVideoProgress} sx={{ mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#5D4037', fontWeight: 500, mb: 1 }}>
                          {hdVideoMessage || 'Generating HD video...'} {hdVideoProgress}%
                        </Typography>
                        {state.hdVideoGenerationStatus === 'awaiting_approval' && (
                          <Typography variant="body2" sx={{ color: '#1976d2', display: 'block', mb: 1, fontWeight: 500 }}>
                            ⏸ Awaiting your approval for Scene {state.currentHdSceneIndex + 1} of {state.outlineScenes?.length || 0}
                          </Typography>
                        )}
                        {state.hdVideoGenerationStatus === 'generating' && (
                          <Typography variant="body2" sx={{ color: '#5D4037', display: 'block', mb: 1 }}>
                            Processing Scene {state.currentHdSceneIndex + 1} of {state.outlineScenes?.length || 0}...
                          </Typography>
                        )}
                        {state.sceneHdVideos && state.sceneHdVideos.size > 0 && (
                          <Typography variant="caption" sx={{ color: '#4caf50', display: 'block', mb: 1, fontWeight: 500 }}>
                            ✓ {state.sceneHdVideos.size} of {state.outlineScenes?.length || 0} scenes approved
                          </Typography>
                        )}
                        
                        {/* Display prompts for completed scenes */}
                        {hdVideoPrompts.size > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: '#1A1611', mb: 1, fontWeight: 600 }}>
                              Generated Prompts:
                            </Typography>
                            {Array.from(hdVideoPrompts.entries())
                              .sort(([a], [b]) => a - b)
                              .map(([sceneNum, prompt]) => (
                                <Box key={sceneNum} sx={{ mb: 2, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #E0DCD4' }}>
                                  <Typography variant="caption" sx={{ color: '#5D4037', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    Scene {sceneNum}:
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: '#2C2416', 
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      display: 'block',
                                    }}
                                  >
                                    {prompt.length > 200 ? `${prompt.substring(0, 200)}...` : prompt}
                                  </Typography>
                                </Box>
                              ))}
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    {state.hdVideoGenerationStatus === 'completed' && (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        HD video generation complete! {state.sceneHdVideos?.size || 0} of {state.outlineScenes?.length || 0} scenes were approved.
                      </Alert>
                    )}
                  </Box>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<VideoLibraryIcon />}
                  onClick={handleGenerateVideo}
                  disabled={
                    isGeneratingVideo ||
                    !state.outlineScenes ||
                    !state.sceneImages ||
                    state.sceneImages.size === 0 ||
                    !state.sceneAudio ||
                    state.sceneAudio.size === 0
                  }
                >
                  {isGeneratingVideo ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Generating Video...
                    </>
                  ) : (
                    'Generate Video'
                  )}
                </Button>
                {state.storyVideo && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadVideo}
                  >
                    Download Video
                  </Button>
                )}
              </Box>
            </Box>
            ) : (
              <Alert severity="info" sx={{ mb: 4 }}>
                Story video generation is disabled in Story Setup. Enable it to create narrated videos.
              </Alert>
            )
          )}

        </>
      )}
    </Paper>
    
    {/* Scene Video Approval Modal */}
    {approvalModal && state.outlineScenes && (
      <SceneVideoApproval
        open={approvalModal.open}
        sceneNumber={approvalModal.sceneNumber}
        sceneTitle={approvalModal.sceneTitle}
        totalScenes={state.outlineScenes.length}
        videoUrl={approvalModal.videoUrl}
        promptUsed={approvalModal.promptUsed}
        onApprove={handleApprove}
        onReject={handleReject}
        onRegenerate={handleRegenerate}
        isRegenerating={regeneratingScene === approvalModal.sceneNumber}
        onClose={() => {
          if (!isGeneratingHdVideo && !regeneratingScene) {
            setApprovalModal(null);
            state.setHdVideoGenerationStatus('paused');
          }
        }}
      />
    )}
    </>
  );
};

export default StoryExport;
