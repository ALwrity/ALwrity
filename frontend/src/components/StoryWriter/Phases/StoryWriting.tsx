import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Tooltip,
  Dialog,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GlobalStyles from '@mui/material/GlobalStyles';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'framer-motion';
import { useStoryWriterState } from '../../../hooks/useStoryWriterState';
import { storyWriterApi } from '../../../services/storyWriterApi';
import { triggerSubscriptionError } from '../../../api/client';
import { aiApiClient } from '../../../api/client';
import { fetchMediaBlobUrl } from '../../../utils/fetchMediaBlobUrl';
import { MultimediaSection } from '../components/MultimediaSection';
import { StoryWritingProgressModal } from './StorySetup/StoryWritingProgressModal';
import { SceneImageGenerationProgressModal } from './StorySetup/SceneImageGenerationProgressModal';
import EditSectionModal from './StoryOutlineParts/EditSectionModal';
import ImageEditModal from './StoryOutlineParts/ImageEditModal';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import {
  StoryImageGenerationModal,
  StoryImageGenerationSettings,
} from '../components/StoryImageGenerationModal';

const MotionBox = motion.create(Box);

const renderMarkdown = (md: string): string => {
  if (!md) return '';
  try {
    const html = marked.parse(md);
    return typeof html === 'string' ? html : '';
  } catch {
    return md;
  }
};

// Define cubic bezier easing arrays as const to preserve tuple types
const easeInOut = [0.22, 0.61, 0.36, 1] as const;
const easeOut = [0.4, 0, 1, 1] as const;

const leftPageVariants = {
  enter: (direction: number) => ({
    rotateY: direction === 0 ? 0 : direction > 0 ? -20 : 20,
    x: direction === 0 ? 0 : direction > 0 ? -80 : 80,
    opacity: direction === 0 ? 1 : 0,
    transformOrigin: 'center',
  }),
  center: {
    rotateY: 0,
    x: 0,
    opacity: 1,
    transformOrigin: 'center',
    transition: { duration: 0.55, ease: easeInOut },
  },
  exit: (direction: number) => ({
    rotateY: direction === 0 ? 0 : direction > 0 ? 15 : -15,
    x: direction === 0 ? 0 : direction > 0 ? 60 : -60,
    opacity: direction === 0 ? 1 : 0,
    transformOrigin: 'center',
    transition: { duration: 0.4, ease: easeOut },
  }),
};

const rightPageVariants = {
  enter: (direction: number) => ({
    rotateY: direction === 0 ? 0 : direction > 0 ? 25 : -25,
    x: direction === 0 ? 0 : direction > 0 ? 110 : -110,
    opacity: direction === 0 ? 1 : 0,
    transformOrigin: direction >= 0 ? 'right center' : 'left center',
  }),
  center: {
    rotateY: 0,
    x: 0,
    opacity: 1,
    transformOrigin: 'center',
    transition: { duration: 0.55, ease: easeInOut },
  },
  exit: (direction: number) => ({
    rotateY: direction === 0 ? 0 : direction > 0 ? -25 : 25,
    x: direction === 0 ? 0 : direction > 0 ? -90 : 90,
    opacity: direction === 0 ? 1 : 0,
    transformOrigin: direction >= 0 ? 'left center' : 'right center',
    transition: { duration: 0.4, ease: easeOut },
  }),
};

interface StoryWritingProps {
  state: ReturnType<typeof useStoryWriterState>;
  onNext: () => void;
}

// Helper function to check if story is short
const isShortStory = (storyLength: string | null | undefined): boolean => {
  if (!storyLength) return false;
  const storyLengthLower = storyLength.toLowerCase();
  return storyLengthLower.includes('short') || storyLengthLower.includes('1000');
};

// Split story content into sections based on the number of scenes
const splitStoryContent = (content: string, numSections: number): string[] => {
  if (!content || numSections <= 1) {
    return [content || ''];
  }

  // Split by paragraphs (double newlines)
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  if (paragraphs.length === 0) {
    return [content];
  }

  // If we have fewer paragraphs than sections, use paragraphs as sections
  if (paragraphs.length <= numSections) {
    // Pad with empty sections if needed
    const sections = [...paragraphs];
    while (sections.length < numSections) {
      sections.push('');
    }
    return sections;
  }

  // Divide paragraphs into roughly equal sections
  const sections: string[] = [];
  const paragraphsPerSection = Math.ceil(paragraphs.length / numSections);

  for (let i = 0; i < numSections; i++) {
    const start = i * paragraphsPerSection;
    const end = Math.min(start + paragraphsPerSection, paragraphs.length);
    sections.push(paragraphs.slice(start, end).join('\n\n'));
  }

  return sections;
};

const StoryWriting: React.FC<StoryWritingProps> = ({ state, onNext }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState(0);
  const [imageLoadError, setImageLoadError] = useState<Set<number>>(new Set());
  const [imageBlobUrls, setImageBlobUrls] = useState<Map<number, string>>(new Map());
  const [videoBlobUrls, setVideoBlobUrls] = useState<Map<number, string>>(new Map());
  const [videoLoadError, setVideoLoadError] = useState<Set<number>>(new Set());

  // Editing state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePromptDraft, setImagePromptDraft] = useState('');
  const [isImageSettingsModalOpen, setIsImageSettingsModalOpen] = useState(false);
  const [isImageSettingsGenerating, setIsImageSettingsGenerating] = useState(false);
  const [isGeneratingSceneImage, setIsGeneratingSceneImage] = useState(false);
  const [isImageFullscreenOpen, setIsImageFullscreenOpen] = useState(false);

  // Get scenes and images from state
  const scenes = state.outlineScenes || [];
  const sceneImages = state.sceneImages || new Map<number, string>();
  const sceneAnimatedVideos = state.sceneAnimatedVideos || new Map<number, string>();
  const hasScenes = state.isOutlineStructured && scenes.length > 0;
  
  // Split story content into sections mapped to scenes
  const storySections = useMemo(() => {
    if (!state.storyContent) {
      return [];
    }
    
    if (hasScenes && scenes.length > 0) {
      // Split story content into sections based on number of scenes
      return splitStoryContent(state.storyContent, scenes.length);
    }
    
    // If no scenes, treat entire story as one section
    return [state.storyContent];
  }, [state.storyContent, hasScenes, scenes.length]);

  const numPages = Math.max(storySections.length, hasScenes ? scenes.length : 1);
  const currentPage = currentPageIndex < storySections.length ? storySections[currentPageIndex] : '';
  const currentSceneIndex = hasScenes ? Math.min(currentPageIndex, scenes.length - 1) : 0;
  const currentScene = hasScenes ? scenes[currentSceneIndex] : null;
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < numPages - 1;

  // Get the current scene's image URL
  const currentSceneNumber = currentScene?.scene_number || currentSceneIndex + 1;
  const currentSceneImageUrl = sceneImages.get(currentSceneNumber);
  const hasImageLoadError = imageLoadError.has(currentSceneNumber);

  // Fetch image as blob with authentication
  useEffect(() => {
    if (!currentSceneImageUrl || hasImageLoadError || imageBlobUrls.has(currentSceneNumber)) {
      return;
    }
    
    const loadImage = async () => {
      try {
        // Remove query parameters (token) from URL if present, we'll use authenticated request instead
        const cleanUrl = currentSceneImageUrl.split('?')[0];
        // Use relative URL path directly (aiApiClient will add base URL and auth)
        const imageUrl = cleanUrl.startsWith('/') 
          ? cleanUrl 
          : `/${cleanUrl}`;
        // Use aiApiClient to get authenticated response with blob
        const response = await aiApiClient.get(imageUrl, {
          responseType: 'blob',
        });
        
        const blob = response.data;
        const blobUrl = URL.createObjectURL(blob);
        
        setImageBlobUrls((prev) => {
          const next = new Map(prev);
          next.set(currentSceneNumber, blobUrl);
          return next;
        });
      } catch (err) {
        console.error('Failed to load image:', err);
        setImageLoadError((prev) => new Set(prev).add(currentSceneNumber));
      }
    };
    
    loadImage();
  }, [currentSceneNumber, currentSceneImageUrl, hasImageLoadError, imageBlobUrls]);

  // Cleanup blob URLs when component unmounts
  const imageBlobUrlsRef = React.useRef(imageBlobUrls);
  useEffect(() => {
    imageBlobUrlsRef.current = imageBlobUrls;
  }, [imageBlobUrls]);

  useEffect(() => {
    return () => {
      // Revoke all blob URLs on unmount using the ref
      imageBlobUrlsRef.current.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
    };
  }, []);

  const currentSceneImageFullUrl = imageBlobUrls.get(currentSceneNumber) || null;
  const currentSceneAnimatedVideoUrl = sceneAnimatedVideos.get(currentSceneNumber) || null;
  const currentSceneAnimatedVideoBlobUrl = videoBlobUrls.get(currentSceneNumber) || null;
  const hasVideoLoadError = videoLoadError.has(currentSceneNumber);
  const showAnimatedVideo = Boolean(currentSceneAnimatedVideoBlobUrl);

  // Reset image load error when page changes
  useEffect(() => {
    setImageLoadError((prev) => {
      const next = new Set(prev);
      next.delete(currentSceneNumber);
      return next;
    });
  }, [currentSceneNumber]);

  useEffect(() => {
    if (!currentSceneAnimatedVideoUrl || hasVideoLoadError || currentSceneAnimatedVideoBlobUrl) {
      return;
    }

    let cancelled = false;

    const loadVideo = async () => {
      try {
        const videoPath = currentSceneAnimatedVideoUrl.startsWith('/')
          ? currentSceneAnimatedVideoUrl
          : `/${currentSceneAnimatedVideoUrl}`;
        const blobUrl = await fetchMediaBlobUrl(videoPath);
        if (!blobUrl || cancelled) {
          if (!blobUrl) {
            setVideoLoadError((prev) => new Set(prev).add(currentSceneNumber));
          }
          return;
        }

        setVideoBlobUrls((prev) => {
          const next = new Map(prev);
          const existing = next.get(currentSceneNumber);
          if (existing) {
            URL.revokeObjectURL(existing);
          }
          next.set(currentSceneNumber, blobUrl);
          return next;
        });
      } catch (err) {
        console.warn('Failed to load animated video:', err);
        setVideoLoadError((prev) => {
          const next = new Set(prev);
          next.add(currentSceneNumber);
          return next;
        });
      }
    };

    loadVideo();

    return () => {
      cancelled = true;
    };
  }, [currentSceneNumber, currentSceneAnimatedVideoUrl, currentSceneAnimatedVideoBlobUrl, hasVideoLoadError]);

  // Cleanup video blob URLs when component unmounts
  const videoBlobUrlsRef = React.useRef(videoBlobUrls);
  useEffect(() => {
    videoBlobUrlsRef.current = videoBlobUrls;
  }, [videoBlobUrls]);

  useEffect(() => {
    return () => {
      videoBlobUrlsRef.current.forEach((blob) => {
        URL.revokeObjectURL(blob);
      });
    };
  }, []);

  useEffect(() => {
    if (storySections.length > 0) {
      setCurrentPageIndex(0);
      setPageDirection(0);
    }
  }, [storySections.length]);

  const lastSavedWordCountRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (!state.projectId) {
      return;
    }
    if (!state.storyContent || !state.storyContent.trim()) {
      return;
    }
    const wordCount = state.storyContent.split(/\s+/).filter((word) => word.length > 0).length;
    if (lastSavedWordCountRef.current === wordCount) {
      return;
    }
    lastSavedWordCountRef.current = wordCount;
    state.saveProjectToDb();
  }, [state.projectId, state.storyContent, state.saveProjectToDb, state]);

  const handlePrevPage = () => {
    if (canGoPrev) {
      setPageDirection(-1);
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      setPageDirection(1);
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const handleGenerateStart = React.useCallback(async () => {
    if (!state.premise || (!state.outline && !state.outlineScenes)) {
      setError('Please generate a premise and outline first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const request = state.getRequest();
      // Use structured scenes if available, otherwise use text outline
      const outline = state.isOutlineStructured && state.outlineScenes 
        ? state.outlineScenes 
        : (state.outline || '');
      
      const response = await storyWriterApi.generateStoryStart(
        state.premise,
        outline,
        request
      );
      
      if (response.success && response.story) {
        state.setStoryContent(response.story);
        state.setIsComplete(response.is_complete);
        state.setError(null);
      } else {
        throw new Error(response.story || 'Failed to generate story');
      }
    } catch (err: any) {
      console.error('Story start generation failed:', err);
      
      // Check if this is a subscription error (429/402) and trigger global subscription modal
      const status = err?.response?.status;
      if (status === 429 || status === 402) {
        console.log('StoryWriting: Detected subscription error, triggering global handler', {
          status,
          data: err?.response?.data
        });
        const handled = await triggerSubscriptionError(err);
        if (handled) {
          console.log('StoryWriting: Global subscription error handler triggered successfully');
          // Don't set local error - let the global modal handle it
          setIsGenerating(false);
          return;
        } else {
          console.warn('StoryWriting: Global subscription error handler did not handle the error');
        }
      }
      
      // For non-subscription errors, show local error message
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate story';
      setError(errorMessage);
      state.setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [state]);

  useEffect(() => {
    if (state.autoGenerateOnWriting && !state.storyContent && !isGenerating) {
      const run = async () => {
        await handleGenerateStart();
        state.setAutoGenerateOnWriting(false);
      };
      run();
    }
  }, [state.autoGenerateOnWriting, state.storyContent, isGenerating, handleGenerateStart, state]);

  const handleContinue = async () => {
    if (!state.premise || (!state.outline && !state.outlineScenes) || !state.storyContent) {
      setError('Please generate story content first');
      return;
    }

    setIsContinuing(true);
    setError(null);

    try {
      const request = state.getRequest();
      // Use structured scenes if available, otherwise use text outline
      const outline = state.isOutlineStructured && state.outlineScenes 
        ? state.outlineScenes 
        : (state.outline || '');
      
      const continueRequest = {
        ...request,
        premise: state.premise,
        outline: outline,
        story_text: state.storyContent,
      };
      
      const response = await storyWriterApi.continueStory(continueRequest);
      
      if (response.success && response.continuation) {
        // Check if continuation is IAMDONE marker
        const isDone = response.is_complete || /IAMDONE/i.test(response.continuation);
        
        // Strip IAMDONE marker if present for cleaner display
        const cleanContinuation = response.continuation.replace(/IAMDONE/gi, '').trim();
        
        // Only append continuation if it's not just IAMDONE or empty
        if (cleanContinuation) {
          state.setStoryContent((state.storyContent || '') + '\n\n' + cleanContinuation);
        }
        
        // Set completion status
        state.setIsComplete(isDone);
        
        // If story is complete, show success message
        if (isDone) {
          console.log('Story is complete. Word count target reached.');
        }
        
        state.setError(null);
      } else {
        throw new Error(response.continuation || 'Failed to continue story');
      }
    } catch (err: any) {
      console.error('Story continuation failed:', err);
      
      // Check if this is a subscription error (429/402) and trigger global subscription modal
      const status = err?.response?.status;
      if (status === 429 || status === 402) {
        console.log('StoryWriting: Detected subscription error in continuation, triggering global handler', {
          status,
          data: err?.response?.data
        });
        const handled = await triggerSubscriptionError(err);
        if (handled) {
          console.log('StoryWriting: Global subscription error handler triggered successfully');
          // Don't set local error - let the global modal handle it
          setIsContinuing(false);
          return;
        } else {
          console.warn('StoryWriting: Global subscription error handler did not handle the error');
        }
      }
      
      // For non-subscription errors, show local error message
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to continue story';
      setError(errorMessage);
      state.setError(errorMessage);
    } finally {
      setIsContinuing(false);
    }
  };

  const openEditModal = () => {
    setEditText(currentPage);
    setAiFeedback('');
    setAiSuggestions([]);
    setIsEditModalOpen(true);
  };

  const handleSaveUpdatedSection = () => {
    if (!state.storyContent) {
      setIsEditModalOpen(false);
      return;
    }
    // Replace the current section in the full story content
    const sections = storySections;
    const before = sections.slice(0, currentPageIndex).join('\n\n');
    const after = sections.slice(currentPageIndex + 1).join('\n\n');
    const updated = [before, editText, after].filter(Boolean).join('\n\n');
    state.setStoryContent(updated);
    setIsEditModalOpen(false);
  };

  const handleGenerateAISuggestions = async () => {
    setAiLoading(true);
    try {
      const base = (editText || currentPage || '').trim();
      const suggestion1 = `${base}\n\n[Variant A] Improved pacing and clarity with stronger narrative flow.`;
      const suggestion2 = `${base}\n\n[Variant B] Richer sensory details and deeper emotional resonance.`;
      setAiSuggestions([suggestion1, suggestion2]);
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (index: number) => {
    const chosen = aiSuggestions[index];
    if (chosen) {
      setEditText(chosen);
    }
  };

  const openImageModal = () => {
    setImagePromptDraft(currentScene?.image_prompt || '');
    setIsImageModalOpen(true);
  };

  const handleSaveImagePrompt = () => {
    if (!hasScenes || !currentScene) { setIsImageModalOpen(false); return; }
    const updated = [...scenes];
    updated[currentSceneIndex] = { ...updated[currentSceneIndex], image_prompt: imagePromptDraft };
    (state.setOutlineScenes as any)(updated);
    setIsImageModalOpen(false);
  };

  const handleGenerateSceneImage = async (promptOverride?: string) => {
    if (!hasScenes || !currentScene) return;
    setIsGeneratingSceneImage(true);
    try {
      const prompt = promptOverride || imagePromptDraft || currentScene?.image_prompt || '';
      if (!prompt.trim()) {
        return;
      }
      const sceneNum = currentScene.scene_number || currentSceneIndex + 1;
      const sceneTitle = currentScene.title || `Scene ${sceneNum}`;

      const resp = await storyWriterApi.regenerateSceneImage({
        scene_number: sceneNum,
        scene_title: sceneTitle,
        prompt: prompt.trim(),
        provider: state.imageProvider || undefined,
        width: state.imageWidth,
        height: state.imageHeight,
        model: state.imageModel || undefined,
      });

      if (resp.success && resp.image_url) {
        // Store the new image URL
        const nextMap = new Map(state.sceneImages || []);
        nextMap.set(sceneNum, resp.image_url);
        state.setSceneImages(nextMap);

        // Fetch the blob URL directly so the image appears immediately
        try {
          const cleanUrl = resp.image_url.split('?')[0];
          const imageUrl = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
          const blobResp = await aiApiClient.get(imageUrl, { responseType: 'blob' });
          const blobUrl = URL.createObjectURL(blobResp.data);
          setImageBlobUrls((prev) => {
            const next = new Map(prev);
            const oldBlob = next.get(sceneNum);
            if (oldBlob) URL.revokeObjectURL(oldBlob);
            next.set(sceneNum, blobUrl);
            return next;
          });
          setImageLoadError((prev) => {
            const next = new Set(prev);
            next.delete(sceneNum);
            return next;
          });
        } catch (fetchErr) {
          console.error('Failed to load generated image:', fetchErr);
          setImageLoadError((prev) => new Set(prev).add(sceneNum));
        }
      } else {
        throw new Error(resp.error || 'Failed to generate image');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to generate image';
      state.setError(errorMessage);
    } finally {
      setIsGeneratingSceneImage(false);
    }
  };

  const handleOpenAdvancedImageSettings = (prompt: string) => {
    setImagePromptDraft(prompt);
    setIsImageSettingsModalOpen(true);
  };

  const handleGenerateImageWithSettings = async (settings: StoryImageGenerationSettings) => {
    if (!hasScenes || !currentScene) return;
    setIsImageSettingsGenerating(true);
    try {
      const sceneNum = currentScene.scene_number || currentSceneIndex + 1;
      const sceneTitle = currentScene.title || `Scene ${sceneNum}`;

      const resp = await storyWriterApi.regenerateSceneImage({
        scene_number: sceneNum,
        scene_title: sceneTitle,
        prompt: settings.prompt.trim(),
        provider: state.imageProvider || undefined,
        width: state.imageWidth,
        height: state.imageHeight,
        model: settings.model || state.imageModel || undefined,
      });

      if (resp.success && resp.image_url) {
        const nextMap = new Map(state.sceneImages || []);
        nextMap.set(sceneNum, resp.image_url);
        state.setSceneImages(nextMap);
        setImagePromptDraft(settings.prompt.trim());
        setIsImageSettingsModalOpen(false);
        setIsImageModalOpen(false);
      } else {
        throw new Error(resp.error || 'Failed to generate image');
      }
    } catch (err: any) {
      console.error('Failed to generate scene image with settings:', err);
    } finally {
      setIsImageSettingsGenerating(false);
    }
  };

  const handleContinueToExport = () => {
    if (state.storyContent && state.isComplete) {
      onNext();
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
          '.tw-shadow-book': {
            boxShadow: '0 36px 80px rgba(45, 30, 15, 0.35)',
          },
          '.tw-rounded-book': {
            borderRadius: '20px',
          },
          '.tw-page-accent': {
            background: 'linear-gradient(120deg, #f9e6c8, #f2d8b4)',
          },
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
        }}
      />
      {state.storyContent && (
        <Typography variant="body2" sx={{ mb: 3, color: '#5D4037', fontStyle: 'italic' }}>
          Current word count: {state.storyContent.split(/\s+/).filter(word => word.length > 0).length} words
          {state.storyLength && (
            <> (Target: {state.storyLength.includes('1000') ? '>1000' : state.storyLength.includes('5000') ? '>5000' : '>10000'} words)</>
          )}
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {(!state.premise || (!state.outline && !state.outlineScenes)) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please generate a premise and outline first.
        </Alert>
      )}

      {state.storyContent ? (
        <>
          {hasScenes && numPages > 1 ? (
            // Book-like UI with images
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
              <Box
                className="tw-shadow-book tw-rounded-book"
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '100%',
                  minHeight: 520,
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  borderRadius: '20px',
                  overflow: 'hidden',
                  boxShadow: '0 36px 80px rgba(45, 30, 15, 0.35)',
                  background: 'linear-gradient(120deg, #fff9ef 0%, #f5e1c7 45%, #fff9ef 100%)',
                }}
              >
                <AnimatePresence mode="wait" custom={pageDirection}>
                  <MotionBox
                    key={`book-pages-${currentPageIndex}`}
                    custom={pageDirection}
                    variants={{}}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    sx={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      position: 'relative',
                      height: '100%',
                    }}
                  >
                    {/* Left page - Image */}
                    <MotionBox
                      key={`image-${currentPageIndex}`}
                      role="button"
                      aria-label="Previous page"
                      onClick={handlePrevPage}
                      custom={pageDirection}
                      variants={leftPageVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      sx={{
                        flexBasis: { xs: '100%', md: '48%' },
                        maxWidth: { xs: '100%', md: '48%' },
                        padding: { xs: 3, md: 4, lg: 5 },
                        pr: { xs: 3, md: 5, lg: 6 },
                        borderRight: '1px solid rgba(120, 90, 60, 0.18)',
                        cursor: canGoPrev ? 'pointer' : 'default',
                        background:
                          'linear-gradient(100deg, rgba(255,255,255,0.82) 0%, rgba(250,240,225,0.95) 50%, rgba(242,226,204,0.9) 100%)',
                        boxShadow: 'inset -18px 0 30px rgba(160, 120, 90, 0.18)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        '&:hover': canGoPrev
                          ? {
                              transform: 'translateX(-4px) rotate(-0.3deg)',
                              boxShadow: 'inset -24px 0 50px rgba(145, 110, 72, 0.25)',
                            }
                          : undefined,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 18,
                          bottom: 18,
                          right: '-12px',
                          width: 24,
                          background:
                            'linear-gradient(180deg, rgba(220,190,150,0.25) 0%, rgba(200,160,120,0) 50%, rgba(220,190,150,0.25) 100%)',
                          filter: 'blur(5px)',
                          opacity: 0.8,
                        },
                      }}
                    >
                      {showAnimatedVideo ? (
                        <Box
                          sx={{
                            width: '100%',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18), 0 4px 8px rgba(0, 0, 0, 0.12)',
                            border: '3px solid rgba(120, 90, 60, 0.25)',
                            backgroundColor: '#000',
                          }}
                        >
                          <Box
                            component="video"
                            src={currentSceneAnimatedVideoBlobUrl ?? undefined}
                            poster={currentSceneImageFullUrl ?? undefined}
                            autoPlay
                            muted
                            loop
                            controls
                            playsInline
                            sx={{
                              width: '100%',
                              height: 'auto',
                              display: 'block',
                              minHeight: '300px',
                              maxHeight: '500px',
                              objectFit: 'cover',
                            }}
                          />
                        </Box>
                      ) : currentSceneImageFullUrl ? (
                        <Box sx={{ position: 'relative' }}>
                          <Box
                            sx={{
                              width: '100%',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18), 0 4px 8px rgba(0, 0, 0, 0.12)',
                              border: '3px solid rgba(120, 90, 60, 0.25)',
                              backgroundColor: '#fff',
                              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                              '&:hover': {
                                transform: 'translateY(-4px) scale(1.01)',
                                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.18)',
                              },
                            }}
                          >
                            <Box
                              component="img"
                              src={currentSceneImageFullUrl}
                              alt={currentScene?.title || `Scene ${currentSceneNumber} illustration`}
                              sx={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                                objectFit: 'contain',
                                minHeight: '300px',
                                maxHeight: '500px',
                              }}
                              onError={() => {
                                setImageLoadError((prev) => new Set(prev).add(currentSceneNumber));
                              }}
                            />
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              display: 'flex',
                              gap: 4,
                              zIndex: 4,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip title="View image full size">
                              <Box
                                role="button"
                                onClick={() => setIsImageFullscreenOpen(true)}
                                sx={{
                                  width: 32, height: 32, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'linear-gradient(135deg, #111827 0%, #4b5563 100%)',
                                  boxShadow: '0 4px 10px rgba(15,23,42,0.35)',
                                  color: 'white', cursor: 'pointer',
                                }}
                              >
                                <OpenInFullIcon fontSize="small" />
                              </Box>
                            </Tooltip>
                            <Tooltip title="Edit image prompt">
                              <Box
                                role="button"
                                onClick={openImageModal}
                                sx={{
                                  width: 32, height: 32, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'linear-gradient(135deg, #7F5AF0 0%, #2CB67D 100%)',
                                  boxShadow: '0 4px 10px rgba(127,90,240,0.3)',
                                  color: 'white', cursor: 'pointer',
                                }}
                              >
                                <EditNoteIcon fontSize="small" />
                              </Box>
                            </Tooltip>
                          </Box>
                        </Box>
                      ) : (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ color: '#7a5335', textTransform: 'uppercase', letterSpacing: 1 }}>
                              Image Prompt
                            </Typography>
                            <Tooltip title="Edit image prompt">
                              <Box
                                role="button"
                                onClick={openImageModal}
                                sx={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'linear-gradient(135deg, #7F5AF0 0%, #2CB67D 100%)',
                                  color: 'white', cursor: 'pointer',
                                }}
                              >
                                <EditNoteIcon fontSize="small" />
                              </Box>
                            </Tooltip>
                            <Tooltip title="Generate scene image">
                              <Box
                                role="button"
                                onClick={() => handleGenerateSceneImage()}
                                sx={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'linear-gradient(135deg, #1f8a70 0%, #32d9c8 100%)',
                                  boxShadow: '0 4px 10px rgba(31,138,112,0.3)',
                                  color: 'white', cursor: 'pointer',
                                  opacity: isGeneratingSceneImage || !currentScene?.image_prompt ? 0.5 : 1,
                                }}
                              >
                                {isGeneratingSceneImage ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <AutoFixHighIcon fontSize="small" />}
                              </Box>
                            </Tooltip>
                          </Box>
                          <Typography variant="body2" sx={{ color: '#3f3224', lineHeight: 1.7, mb: 2, whiteSpace: 'pre-wrap' }}>
                            {currentScene?.image_prompt || 'No image prompt available for this scene.'}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, width: '100%' }}>
                        <Typography variant="caption" sx={{ color: '#7a5335' }}>
                          Click to turn back
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#a37b55' }}>
                          {canGoPrev ? '← Previous page' : 'Start of story'}
                        </Typography>
                      </Box>
                    </MotionBox>

                    {/* Right page - Story text */}
                    <MotionBox
                      key={`story-${currentPageIndex}`}
                      role="button"
                      aria-label="Next page"
                      onClick={handleNextPage}
                      custom={pageDirection}
                      variants={rightPageVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      sx={{
                        flexBasis: { xs: '100%', md: '52%' },
                        maxWidth: { xs: '100%', md: '52%' },
                        padding: { xs: 3, md: 4, lg: 5 },
                        pl: { xs: 3, md: 5, lg: 6 },
                        cursor: canGoNext ? 'pointer' : 'default',
                        background:
                          'linear-gradient(260deg, rgba(255,255,255,0.88) 0%, rgba(249,236,215,0.96) 45%, rgba(243,226,206,0.92) 100%)',
                        boxShadow: 'inset 18px 0 30px rgba(160, 120, 90, 0.18)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': canGoNext
                          ? {
                              transform: 'translateX(4px) rotate(0.3deg)',
                              boxShadow: 'inset 24px 0 50px rgba(145, 110, 72, 0.25)',
                            }
                          : undefined,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 18,
                          bottom: 18,
                          left: '-12px',
                          width: 24,
                          background:
                            'linear-gradient(180deg, rgba(220,190,150,0.25) 0%, rgba(200,160,120,0) 50%, rgba(220,190,150,0.25) 100%)',
                          filter: 'blur(5px)',
                          opacity: 0.8,
                        },
                      }}
                    >
                      <Box sx={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                        <Tooltip title="Edit this section">
                          <Box
                            role="button"
                            onClick={(e) => { e.stopPropagation(); openEditModal(); }}
                            sx={{
                              position: 'absolute', top: 0, right: 0, zIndex: 4,
                              width: 32, height: 32, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'linear-gradient(135deg, #7F5AF0 0%, #2CB67D 100%)',
                              boxShadow: '0 4px 10px rgba(127,90,240,0.3)',
                              color: 'white', cursor: 'pointer',
                              opacity: 0.7, '&:hover': { opacity: 1 },
                            }}
                          >
                            <EditNoteIcon fontSize="small" />
                          </Box>
                        </Tooltip>
                        {currentPage ? (
                          <Box
                            className="rendered-content"
                            sx={{
                              color: '#2C2416',
                              lineHeight: 1.8,
                              fontFamily: `'Georgia', 'Times New Roman', serif`,
                              fontSize: '1.1rem',
                              wordBreak: 'break-word',
                            }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(currentPage) }}
                          />
                        ) : (
                          <Typography variant="body1" sx={{ color: '#2C2416', fontFamily: `'Georgia', 'Times New Roman', serif` }}>
                            Loading...
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                        <Typography variant="caption" sx={{ color: '#a37b55' }}>
                          {canGoNext ? 'Next page →' : 'End of story'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#7a5335' }}>
                          Page {currentPageIndex + 1} of {numPages}
                        </Typography>
                      </Box>
                    </MotionBox>
                  </MotionBox>
                </AnimatePresence>
              </Box>
            </Box>
          ) : (
            // Simple text display if no scenes
            <Box sx={{ mb: 3 }}>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: '#FAF9F6',
                  minHeight: '400px',
                }}
              >
                <Box
                  className="rendered-content"
                  sx={{
                    color: '#2C2416',
                    lineHeight: 1.8,
                    fontFamily: `'Georgia', 'Times New Roman', serif`,
                    fontSize: '1.1rem',
                    wordBreak: 'break-word',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(state.storyContent || '') }}
                />
              </Paper>
            </Box>
          )}

          {/* Multimedia Generation Section */}
          {state.isOutlineStructured && state.outlineScenes && state.outlineScenes.length > 0 && (
            <MultimediaSection state={state} />
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Only show Continue Writing button for medium/long stories that are not complete */}
            {!state.isComplete && !isShortStory(state.storyLength) && (
              <Button
                variant="outlined"
                onClick={handleContinue}
                disabled={isContinuing || !state.storyContent}
              >
                {isContinuing ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Continuing...
                  </>
                ) : (
                  'Continue Writing'
                )}
              </Button>
            )}
            {/* Show completion message if story is complete */}
            {state.isComplete && (
              <Alert severity="success" sx={{ flex: 1, minWidth: '200px' }}>
                Story is complete! You can proceed to export.
              </Alert>
            )}
            {/* Show info message for short stories that are not complete yet */}
            {!state.isComplete && isShortStory(state.storyLength) && (
              <Alert severity="info" sx={{ flex: 1, minWidth: '200px' }}>
                Short stories are generated in one call. If the story is incomplete, please regenerate it.
              </Alert>
            )}
            <Button
              variant="contained"
              onClick={handleContinueToExport}
              disabled={!state.storyContent || !state.isComplete}
            >
              Continue to Export
            </Button>
          </Box>
        </>
      ) : (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            {!state.premise || (!state.outline && !state.outlineScenes)
              ? 'Please generate a premise and outline first.'
              : state.autoGenerateOnWriting || isGenerating
                ? 'Generating your story now...'
                : 'Click "Generate Story" to start writing your story.'}
          </Alert>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleGenerateStart}
              disabled={isGenerating || !state.premise || (!state.outline && !state.outlineScenes)}
            >
              {isGenerating ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Generating...
                </>
              ) : (
                'Generate Story'
              )}
            </Button>
          </Box>
        </Box>
      )}
    </Paper>

      {/* Fullscreen image viewer */}
      <Dialog
        open={isImageFullscreenOpen}
        onClose={() => setIsImageFullscreenOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'black', borderRadius: 2 } }}
      >
        <IconButton
          onClick={() => setIsImageFullscreenOpen(false)}
          sx={{
            position: 'absolute', top: 8, right: 8, zIndex: 10,
            color: 'white', bgcolor: 'rgba(0,0,0,0.5)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: '60vh' }}>
          {currentSceneImageFullUrl ? (
            <Box
              component="img"
              src={currentSceneImageFullUrl}
              alt={currentScene?.title || `Scene ${currentSceneNumber} illustration`}
              sx={{ width: '100%', maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'white' }}>
              No image is available for this scene yet.
            </Typography>
          )}
        </Box>
      </Dialog>

      {/* Scene text editor */}
      <EditSectionModal
        open={isEditModalOpen}
        sceneNumber={currentSceneNumber}
        editText={editText}
        onChangeEditText={setEditText}
        aiFeedback={aiFeedback}
        onChangeAiFeedback={setAiFeedback}
        aiLoading={aiLoading}
        onGenerateSuggestions={handleGenerateAISuggestions}
        suggestions={aiSuggestions}
        onPickSuggestion={applySuggestion}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveUpdatedSection}
      />

      {/* Image prompt editor */}
      <ImageEditModal
        open={isImageModalOpen}
        sceneNumber={currentSceneNumber}
        value={imagePromptDraft}
        onChange={setImagePromptDraft}
        onClose={() => setIsImageModalOpen(false)}
        onSave={handleSaveImagePrompt}
        onRegenerate={handleGenerateSceneImage}
        imageProvider={state.imageProvider}
        imageWidth={state.imageWidth}
        imageHeight={state.imageHeight}
        imageModel={state.imageModel}
        onOpenAdvancedSettings={handleOpenAdvancedImageSettings}
      />

      {/* Advanced image settings */}
      <StoryImageGenerationModal
        open={isImageSettingsModalOpen}
        onClose={() => setIsImageSettingsModalOpen(false)}
        onGenerate={handleGenerateImageWithSettings}
        initialPrompt={imagePromptDraft}
        sceneTitle={currentScene?.title || undefined}
        storyMode={state.storyMode}
        isGenerating={isImageSettingsGenerating}
      />

      <StoryWritingProgressModal
        open={isGenerating}
        isShortStory={isShortStory(state.storyLength)}
      />
      <SceneImageGenerationProgressModal
        open={isGeneratingSceneImage}
        sceneTitle={currentScene?.title}
      />
    </>
  );
};

export default StoryWriting;
