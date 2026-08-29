import React, { useState, useEffect } from "react";
import { Stack, Box, Typography, Divider, Chip, alpha, CircularProgress, LinearProgress, IconButton, Tooltip, Dialog, DialogContent } from "@mui/material";
import EditNoteIcon from '@mui/icons-material/EditNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import MicIcon from '@mui/icons-material/Mic';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Scene, Line, Knobs } from "../types";
import { GlassyCard, glassyCardSx, PrimaryButton } from "../ui";
import { OperationButton } from "../../shared/OperationButton";
import { LineEditor } from "./LineEditor";
import { ImageRegenerateModal, ImageGenerationSettings } from "./ImageRegenerateModal";
import { AudioRegenerateModal, AudioGenerationSettings } from "./AudioRegenerateModal";
import { podcastApi, getCachedVoiceCloneInfo } from "../../../services/podcastApi";
import { aiApiClient } from "../../../api/client";
import { getCachedMedia, setCachedMedia } from "../../../utils/mediaCache";

interface SceneEditorProps {
  scene: Scene;
  onUpdateScene: (s: Scene) => void;
  onApprove: (id: string) => Promise<void>;
  onDelete: (sceneId: string) => void;
  knobs: Knobs;
  approvingSceneId?: string | null;
  generatingAudioId?: string | null;
  onAudioGenerationStart?: (sceneId: string) => void;
  onAudioGenerated?: (sceneId: string, audioUrl: string) => void;
  idea?: string; // Podcast idea for image generation context
  projectId?: string; // Project ID for session character locking
  avatarUrl?: string | null; // Base avatar URL for consistent scene image generation
  totalScenes?: number; // Total number of scenes in the script
  sceneIndex?: number; // Current scene index (0-based) for 1/N numbering
  analysis?: {
    audience?: string;
    contentType?: string;
    topKeywords?: string[];
  } | null;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({
  scene,
  onUpdateScene,
  onApprove,
  onDelete,
  knobs,
  approvingSceneId,
  generatingAudioId,
  onAudioGenerationStart,
  onAudioGenerated,
  idea,
  projectId,
  avatarUrl,
  totalScenes,
  sceneIndex,
  analysis,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageGenerationStatus, setImageGenerationStatus] = useState<string>("");
  const [imageGenerationProgress, setImageGenerationProgress] = useState<number>(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showApprovalInfo, setShowApprovalInfo] = useState(false);
  const [showWhyScript, setShowWhyScript] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioGenerationSettings>({
    voiceId: knobs.voice_id || "Wise_Woman",
    customVoiceId: knobs.custom_voice_id || undefined,
    useVoiceClone: knobs.is_voice_clone || false,
    voiceSampleUrl: knobs.voice_sample_url || undefined,
    voiceCloneEngine: knobs.voice_clone_engine || undefined,
    speed: knobs.voice_speed ?? 1.0,
    volume: 1.0,
    pitch: 0.0,
    emotion: scene.emotion || knobs.voice_emotion || "neutral",
    englishNormalization: true,
    sampleRate: knobs.sample_rate || 24000,
    bitrate: knobs.bitrate === 'hd' ? 128000 : 64000,
    channel: "1",
    format: "mp3",
    languageBoost: "auto",
  });

  // Load audio as blob when audioUrl is available
  useEffect(() => {
    if (!scene.audioUrl) {
      // Clean up blob URL if audioUrl is removed
      setAudioBlobUrl((currentBlobUrl) => {
        if (currentBlobUrl) {
          URL.revokeObjectURL(currentBlobUrl);
        }
        return null;
      });
      return;
    }

    let isMounted = true;
    const currentAudioUrl = scene.audioUrl; // Capture current value

    const loadAudioBlob = async () => {
      try {
        // Normalize path
        let audioPath = currentAudioUrl.startsWith('/') ? currentAudioUrl : `/${currentAudioUrl}`;
        
        // Convert /api/story/audio/ to /api/podcast/audio/ if needed
        if (audioPath.includes('/api/story/audio/')) {
          const filename = audioPath.split('/api/story/audio/').pop() || '';
          audioPath = `/api/podcast/audio/${filename}`;
        }
        
        // Ensure it's a podcast audio endpoint
        if (!audioPath.includes('/api/podcast/audio/')) {
          const filename = audioPath.split('/').pop() || currentAudioUrl;
          audioPath = `/api/podcast/audio/${filename}`;
        }

        // Remove query parameters if present
        audioPath = audioPath.split('?')[0];

        const response = await aiApiClient.get(audioPath, {
          responseType: 'blob',
        });
        
        if (!isMounted) {
          // Component unmounted or audioUrl changed, don't set blob URL
          return;
        }
        
        // Double-check that audioUrl hasn't changed
        if (scene.audioUrl !== currentAudioUrl) {
          return;
        }
        
        const blob = response.data;
        const blobUrl = URL.createObjectURL(blob);
        
        setAudioBlobUrl((prevBlobUrl) => {
          // Clean up previous blob URL if exists
          if (prevBlobUrl && prevBlobUrl !== blobUrl) {
            URL.revokeObjectURL(prevBlobUrl);
          }
          return blobUrl;
        });
      } catch (error) {
        console.error(`Failed to load audio blob for scene ${scene.id}:`, error);
        // Don't set blob URL on error - will show error state
      }
    };

    loadAudioBlob();

    // Cleanup: only mark as unmounted, don't revoke blob URL here
    // The blob URL will be cleaned up when audioUrl changes (new effect) or component unmounts
    return () => {
      isMounted = false;
    };
  }, [scene.audioUrl, scene.id]);

  // Load image as blob when imageUrl is available
  useEffect(() => {
    if (!scene.imageUrl) {
      // Clean up blob URL if imageUrl is removed
      setImageBlobUrl((currentBlobUrl) => {
        if (currentBlobUrl && currentBlobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(currentBlobUrl);
        }
        return null;
      });
      return;
    }

    // Check cache first with scene context
    const cachedUrl = getCachedMedia(scene.imageUrl, scene.id);
    if (cachedUrl) {
      console.log('[SceneEditor] Using cached image:', scene.imageUrl, `(scene: ${scene.id})`);
      setImageBlobUrl(cachedUrl);
      setImageLoading(false);
      return;
    }

    let isMounted = true;
    const currentImageUrl = scene.imageUrl; // Capture current value

    const loadImageBlob = async () => {
      try {
        setImageLoading(true);
        
        // Check cache again in case it was loaded while we were waiting
        const cachedUrl = getCachedMedia(currentImageUrl, scene.id);
        if (cachedUrl) {
          if (isMounted) {
            setImageBlobUrl(cachedUrl);
            setImageLoading(false);
          }
          return;
        }
        
        console.log('[SceneEditor] Loading image blob for:', currentImageUrl);
        
        // Normalize path
        let imagePath = currentImageUrl.startsWith('/') ? currentImageUrl : `/${currentImageUrl}`;
        
        // Convert /api/story/images/ to /api/podcast/images/ if needed
        if (imagePath.includes('/api/story/images/')) {
          const filename = imagePath.split('/api/story/images/').pop() || '';
          imagePath = `/api/podcast/images/${filename}`;
        }
        
        // Ensure it's a podcast image endpoint
        if (!imagePath.includes('/api/podcast/images/')) {
          const filename = imagePath.split('/').pop() || currentImageUrl;
          imagePath = `/api/podcast/images/${filename}`;
        }

        // Remove query parameters if present
        imagePath = imagePath.split('?')[0];

        const response = await aiApiClient.get(imagePath, {
          responseType: 'blob',
        });
        
        if (!isMounted) {
          return;
        }
        
        // Double-check that imageUrl hasn't changed
        if (scene.imageUrl !== currentImageUrl) {
          return;
        }
        
        const blob = response.data;
        const blobUrl = URL.createObjectURL(blob);
        
        // Cache the blob URL with scene context
        setCachedMedia(currentImageUrl, blobUrl, 'image', blob.size, scene.id);
        
        setImageBlobUrl((prevBlobUrl) => {
          // Clean up previous blob URL if exists
          if (prevBlobUrl && prevBlobUrl !== blobUrl && prevBlobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(prevBlobUrl);
          }
          return blobUrl;
        });
        console.log('[SceneEditor] Image blob loaded and cached successfully:', currentImageUrl);
      } catch (error) {
        console.error('[SceneEditor] Failed to load image blob:', error);
        if (isMounted) {
          // Try adding query token as fallback
          try {
            const token = localStorage.getItem('clerk_dashboard_token') || '';
            if (token) {
              const urlWithToken = `${currentImageUrl}?token=${encodeURIComponent(token)}`;
              setImageBlobUrl(urlWithToken);
              setCachedMedia(currentImageUrl, urlWithToken, 'image', undefined, scene.id);
            }
          } catch (fallbackError) {
            console.error('[SceneEditor] Fallback image loading failed:', fallbackError);
          }
        }
      } finally {
        if (isMounted) {
          setImageLoading(false);
        }
      }
    };

    loadImageBlob();

    return () => {
      isMounted = false;
      // Don't cleanup blob URL here - let the cache handle it
    };
  }, [scene.imageUrl]);

  const updateLine = (updatedLine: Line) => {
    const updated = { ...scene, lines: scene.lines.map((l) => (l.id === updatedLine.id ? updatedLine : l)) };
    onUpdateScene(updated);
  };
  
  const approving = approvingSceneId === scene.id;
  const generating = generatingAudioId === scene.id || localGenerating;
  const hasAudio = Boolean(scene.audioUrl && audioBlobUrl);
  const hasImage = Boolean(scene.imageUrl);
  
  // Completion status for visual feedback
  const isComplete = hasAudio && hasImage;
  const completionPercent = (hasAudio ? 50 : 0) + (hasImage ? 50 : 0);

  // Scene order for 1/N badge display
  const sceneOrder = sceneIndex != null ? sceneIndex + 1 : null;
  const totalScenesInline = totalScenes ?? null;
  const showOrderBadge = sceneOrder != null && totalScenesInline != null;

  const handleApproveAndGenerate = async (settings?: AudioGenerationSettings) => {
    const wasAlreadyApproved = scene.approved;
    const sceneId = scene.id;
    
    try {
      // Set generating state
      setLocalGenerating(true);
      if (onAudioGenerationStart) {
        onAudioGenerationStart(sceneId);
      }

      // If scene is not approved yet, approve it first
      // This will update the parent script state
      if (!scene.approved) {
        await onApprove(sceneId);
        // The parent's approveScene already updated the script state
        // We need to wait for React to propagate the updated scene prop
        // For now, we'll update it locally too to ensure UI updates immediately
        onUpdateScene({ ...scene, approved: true });
      }

      // Use the current scene (which should now be approved)
      // If scene prop hasn't updated yet, use the local update we just made
      const currentScene = { ...scene, approved: true };
      
      // Generate audio
      const effectiveSettings = settings || audioSettings;
      const cachedClone = getCachedVoiceCloneInfo();
      const result = await podcastApi.renderSceneAudio({
        scene: currentScene,
        voiceId: effectiveSettings.voiceId || knobs.voice_id || "Wise_Woman",
        customVoiceId: effectiveSettings.customVoiceId || knobs.custom_voice_id || cachedClone?.customVoiceId,
        useVoiceClone: effectiveSettings.useVoiceClone || knobs.is_voice_clone || cachedClone?.isVoiceClone || false,
        voiceSampleUrl: effectiveSettings.voiceSampleUrl || knobs.voice_sample_url || cachedClone?.voiceSampleUrl || undefined,
        voiceCloneEngine: effectiveSettings.voiceCloneEngine || knobs.voice_clone_engine || cachedClone?.engine || undefined,
        emotion: effectiveSettings.emotion || scene.emotion || knobs.voice_emotion || "neutral",
        speed: effectiveSettings.speed ?? knobs.voice_speed ?? 1.0,
        volume: effectiveSettings.volume ?? 1.0,
        pitch: effectiveSettings.pitch ?? 0.0,
        englishNormalization: effectiveSettings.englishNormalization ?? true,
        sampleRate: effectiveSettings.sampleRate,
        bitrate: effectiveSettings.bitrate,
        channel: effectiveSettings.channel,
        format: effectiveSettings.format,
        languageBoost: effectiveSettings.languageBoost,
      });

      // Update scene with audio URL and ensure approved state
      // This will sync with parent script state
      const updatedScene = { ...currentScene, audioUrl: result.audioUrl, approved: true };
      onUpdateScene(updatedScene);
      
      if (onAudioGenerated) {
        onAudioGenerated(sceneId, result.audioUrl);
      }
    } catch (error) {
      console.error("Failed to approve and generate audio:", error);
      
      // Provide user-friendly error message based on error type
      let userMessage = "Failed to generate audio. Please try again.";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit")) {
          userMessage = "Audio generation limit reached. Please check your subscription and try again.";
        } else if (errorMsg.includes("voice") || errorMsg.includes("custom_voice")) {
          userMessage = "Invalid voice. Please select a different voice and try again.";
        } else if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
          userMessage = "Audio generation timed out. Please try again.";
        } else if (errorMsg.includes("network") || errorMsg.includes("connection")) {
          userMessage = "Network error. Please check your connection and try again.";
        }
      }
      
      // On error, revert approval only if we just approved it in this call
      if (!wasAlreadyApproved) {
        onUpdateScene({ ...scene, approved: false, audioUrl: undefined });
      }
      throw error;
    } finally {
      setLocalGenerating(false);
    }
  };

  const handleGenerateImage = async (settings?: ImageGenerationSettings) => {
    const sceneId = scene.id;
    const startTime = Date.now();
    let progressInterval: NodeJS.Timeout | null = null;
    
    try {
      setGeneratingImage(true);
      setShowRegenerateModal(false);
      setImageGenerationStatus("Submitting image generation request...");
      setImageGenerationProgress(10);
      
      // Build scene content from lines for context
      const sceneContent = scene.lines.map((line) => line.text).join(" ");
      
      // Log avatar URL for debugging
      console.log("[SceneEditor] Generating image with avatarUrl:", avatarUrl);
      console.log("[SceneEditor] Custom settings:", settings);

      // ── Ensure presenter reference image exists (idempotent, non-fatal) ──
      // The backend returns immediately with was_cached=true if already generated.
      // Skip if the user has an avatar (Path A handles identity via Ideogram Character).
      if (projectId && !avatarUrl) {
        try {
          await podcastApi.generatePresenterReference({ projectId });
        } catch (refErr) {
          console.warn("[SceneEditor] Presenter reference non-fatal error:", refErr);
        }
      }

      // Simulate progress updates during API call
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        
        // Update status based on elapsed time

        if (seconds < 5) {
          setImageGenerationStatus("Submitting request to AI service...");
          setImageGenerationProgress(15);
        } else if (seconds < 15) {
          setImageGenerationStatus("AI is generating your image...");
          setImageGenerationProgress(30);
        } else if (seconds < 30) {
          setImageGenerationStatus("Creating character-consistent scene image...");
          setImageGenerationProgress(50);
        } else if (seconds < 60) {
          setImageGenerationStatus("Rendering image details...");
          setImageGenerationProgress(70);
        } else {
          setImageGenerationStatus(`Processing... (${seconds}s elapsed)`);
          setImageGenerationProgress(Math.min(90, 50 + (seconds - 30) / 2));
        }
      }, 1000);
      
      const result = await podcastApi.generateSceneImage({
        sceneId: scene.id,
        sceneTitle: scene.title,
        projectId: projectId,
        sceneContent: sceneContent,
        sceneEmotion: scene.emotion,
        cameraAngle: scene.camera_angle,
        visualAtmosphere: scene.visual_atmosphere,
        baseAvatarUrl: avatarUrl || undefined,
        idea: idea,
        analysis: analysis || undefined,
        width: 1024,
        height: 1024,
        customPrompt: settings?.prompt,
        style: settings?.style,
        renderingSpeed: settings?.renderingSpeed,
        aspectRatio: settings?.aspectRatio,
      });
      
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      setImageGenerationStatus("Finalizing image...");
      setImageGenerationProgress(95);
      
      // Update scene with image URL and the prompt used
      const updatedScene = { 
        ...scene, 
        imageUrl: result.image_url,
        imagePrompt: result.image_prompt || undefined,
      };
      onUpdateScene(updatedScene);
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setImageGenerationStatus(`Image generated successfully in ${elapsed}s`);
      setImageGenerationProgress(100);
      
      // Clear status after a moment
      setTimeout(() => {
        setImageGenerationStatus("");
        setImageGenerationProgress(0);
      }, 2000);
    } catch (error: any) {
      // Clear interval on error
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      console.error("Failed to generate image:", error);
      // Extract error message from response if available
      const errorMessage = error?.response?.data?.detail?.message 
        || error?.response?.data?.detail?.error 
        || error?.response?.data?.detail 
        || error?.message 
        || "Failed to generate image. Please try again.";
      console.error("Error details:", {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: errorMessage,
      });
      
      setImageGenerationStatus(`Error: ${errorMessage}`);
      setImageGenerationProgress(0);
      
      // Show user-friendly error message
      alert(`Image generation failed: ${errorMessage}`);
      throw error;
    } finally {
      // Ensure interval is cleared
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setGeneratingImage(false);
    }
  };

  const handleRegenerateClick = () => {
    setShowRegenerateModal(true);
  };

  const handleAudioRegenerateClick = () => {
    if (hasAudio) {
      setShowAudioModal(true);
    } else {
      handleApproveAndGenerate(audioSettings);
    }
  };

  const handleAudioRegenerate = (settings: AudioGenerationSettings) => {
    setAudioSettings(settings);
    setShowAudioModal(false);
    handleApproveAndGenerate(settings);
  };

  return (
    <GlassyCard 
      sx={{
        ...glassyCardSx,
        border: isComplete 
          ? "2px solid #10b981" 
          : completionPercent > 0 
            ? "2px solid #f59e0b" 
            : "1px solid rgba(15, 23, 42, 0.08)",
        background: isComplete
          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(255, 255, 255, 0.9) 100%)"
          : completionPercent > 0
            ? "linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(255, 255, 255, 0.9) 100%)"
            : glassyCardSx.background,
        boxShadow: isComplete
          ? "0 4px 20px rgba(16, 185, 129, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)"
          : completionPercent > 0
            ? "0 4px 20px rgba(245, 158, 11, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)"
            : glassyCardSx.boxShadow,
      }}
    >
      {/* Completion Progress Bar */}
      <Box sx={{ position: "relative", height: 4, mb: 2, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.04)" }}>
        <Box 
          sx={{ 
            position: "absolute", 
            left: 0, 
            top: 0, 
            bottom: 0, 
            width: `${completionPercent}%`,
            background: isComplete 
              ? "linear-gradient(90deg, #10b981 0%, #059669 100%)" 
              : "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
            transition: "width 0.5s ease",
          }} 
        />
      </Box>
      
      <Stack spacing={{ xs: 2, sm: 2.5 }}>
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          justifyContent="space-between" 
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          spacing={{ xs: 2, sm: 0 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: { xs: 1, sm: 1.5 }, 
                mb: { xs: 0.75, sm: 1 }, 
                color: "#0f172a", 
                fontWeight: 600,
                fontSize: { xs: "1.1rem", sm: "1.25rem" },
                letterSpacing: "-0.01em",
                flexWrap: 'wrap',
              }}
            >
              <EditNoteIcon fontSize="small" sx={{ color: isComplete ? "#059669" : completionPercent > 0 ? "#d97706" : "#667eea", fontSize: { xs: "1.25rem", sm: "1.5rem" } }} />
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { xs: 'normal', sm: 'nowrap' } }}>
                {scene.title}
              </Box>
              {showOrderBadge && (
                <Chip 
                  label={`${sceneOrder}/${totalScenesInline}`} 
                  size="small" 
                  sx={{ 
                    ml: { xs: 0, sm: 0.5 }, 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    height: { xs: 20, sm: 24 }, 
                    fontSize: { xs: '0.65rem', sm: '0.7rem' }, 
                    fontWeight: 700, 
                    color: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                    '& .MuiChip-label': {
                      px: { xs: 0.75, sm: 1 },
                    },
                  }} 
                />
              )}
            </Typography>
            <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} alignItems="center" flexWrap="wrap">
              {/* Completion Status Chip */}
              <Chip
                icon={isComplete ? <CheckCircleIcon /> : completionPercent > 0 ? <RefreshIcon /> : <RadioButtonUncheckedIcon />}
                label={isComplete ? "Complete" : completionPercent > 0 ? `In Progress ${completionPercent}%` : "Pending"}
                size="small"
                sx={{
                  background: isComplete 
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : completionPercent > 0
                      ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                      : "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  height: 26,
                  borderRadius: "12px",
                  px: 1,
                  boxShadow: isComplete 
                    ? "0 3px 12px rgba(16, 185, 129, 0.4)" 
                    : completionPercent > 0
                      ? "0 3px 12px rgba(245, 158, 11, 0.4)"
                      : "0 2px 6px rgba(100, 116, 139, 0.3)",
                  '& .MuiChip-icon': {
                    fontSize: '1rem',
                    color: '#ffffff',
                  },
                  '& .MuiChip-label': {
                    pl: 0.5,
                  },
                }}
              />
              
              {/* Audio Status */}
              <Chip
                icon={hasAudio ? <CheckCircleIcon sx={{ fontSize: '0.875rem !important' }} /> : <VolumeUpIcon sx={{ fontSize: '0.875rem !important' }} />}
                label={hasAudio ? "Audio Ready" : "No Audio"}
                size="small"
                sx={{
                  background: hasAudio 
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  height: 22,
                  borderRadius: "10px",
                  px: 0.75,
                  boxShadow: hasAudio ? "0 2px 8px rgba(16, 185, 129, 0.35)" : "0 1px 4px rgba(100, 116, 139, 0.25)",
                  '& .MuiChip-icon': {
                    color: '#ffffff',
                  },
                  '& .MuiChip-label': {
                    pl: 0.5,
                  },
                }}
              />
              
              {/* Image Status */}
              <Chip
                icon={hasImage ? <CheckCircleIcon sx={{ fontSize: '0.875rem !important' }} /> : <ImageIcon sx={{ fontSize: '0.875rem !important' }} />}
                label={hasImage ? "Image Ready" : "No Image"}
                size="small"
                sx={{
                  background: hasImage 
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  height: 22,
                  borderRadius: "10px",
                  px: 0.75,
                  boxShadow: hasImage ? "0 2px 8px rgba(16, 185, 129, 0.35)" : "0 1px 4px rgba(100, 116, 139, 0.25)",
                  '& .MuiChip-icon': {
                    color: '#ffffff',
                  },
                  '& .MuiChip-label': {
                    pl: 0.5,
                  },
                }}
              />
              
              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500, fontSize: "0.8125rem", ml: 1 }}>
                Duration: {scene.duration}s
              </Typography>
            </Stack>
            
            {/* Approval Info Panel - Inline chips for guidance */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
              {/* Active Voice indicator */}
              <Chip
                icon={<MicIcon sx={{ fontSize: '0.875rem !important' }} />}
                label={`Voice: ${
                  (knobs.is_voice_clone || (knobs.custom_voice_id && (knobs.custom_voice_id.startsWith("vc_") || knobs.custom_voice_id === "MY_VOICE_CLONE")))
                    ? "My Voice Clone"
                    : knobs.voice_id === "Wise_Woman" ? "Wise Woman" : knobs.voice_id?.replace(/_/g, " ") || "Default"
                }`}
                size="small"
                sx={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  height: 22,
                  borderRadius: "10px",
                  px: 0.75,
                  boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
                  '& .MuiChip-icon': { color: '#ffffff' },
                  '& .MuiChip-label': {
                    pl: 0.5,
                  },
                }}
              />
              
              {/* Why Script chip - opens modal with guidance */}
              <Chip
                icon={<HelpOutlineIcon sx={{ fontSize: '0.875rem !important' }} />}
                label="Why Script?"
                size="small"
                onClick={() => setShowWhyScript(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowWhyScript(true);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Learn why scene approval is required"
                sx={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  height: 22,
                  borderRadius: "10px",
                  px: 0.75,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.35)",
                  '& .MuiChip-icon': { color: '#ffffff' },
                  '& .MuiChip-label': {
                    pl: 0.5,
                  },
                  '&:hover': {
                    background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                    boxShadow: "0 3px 10px rgba(245, 158, 11, 0.45)",
                  },
                  '&:focus': {
                    outline: '2px solid rgba(245, 158, 11, 0.6)',
                    outlineOffset: '2px',
                  },
                }}
              />
            </Stack>
          </Box>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 1, sm: 1.5 }} 
            flexWrap="wrap" 
            useFlexGap
            sx={{ 
              width: { xs: '100%', sm: 'auto' },
              '& > *': { width: { xs: '100%', sm: 'auto' } }
            }}
          >
            <Tooltip 
              title={
                hasAudio && !generating
                  ? "✓ Audio generated! Click to regenerate with different settings"
                  : generating
                  ? "Generating audio... please wait"
                  : scene.approved
                  ? "Generate audio for this scene"
                  : "Approve scene and generate audio"
              }
            >
              <Box>
                <OperationButton
                  operation={{
                    provider: "audio",
                    model: "minimax/speech-02-hd",
                    tokens_requested: scene.lines.reduce((sum, l) => sum + l.text.length, 0),
                    operation_type: "tts_full_render",
                    actual_provider_name: "wavespeed",
                  }}
                  label={
                    hasAudio && !generating
                      ? "✓ Regenerate Audio"
                      : generating
                      ? "Generating Audio..."
                      : scene.approved
                      ? "Generate Audio"
                      : "Approve & Generate Audio"
                  }
                  variant="contained"
                  size="medium"
                  startIcon={
                    hasAudio && !generating ? (
                      <RefreshIcon />
                    ) : generating ? (
                      <CircularProgress size={16} sx={{ color: "white" }} />
                    ) : (
                      <PlayArrowIcon />
                    )
                  }
                  showCost={true}
                  checkOnHover={true}
                  checkOnMount={false}
                  onClick={handleAudioRegenerateClick}
                  disabled={approving || generating}
                  loading={approving || generating}
                  sx={{
                    minWidth: { xs: '100%', sm: 200 },
                    background: hasAudio
                      ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    fontWeight: 600,
                    textTransform: "none",
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: { xs: 0.75, sm: 1 },
                    boxShadow: hasAudio 
                      ? "0 4px 14px rgba(16, 185, 129, 0.35)"
                      : "0 4px 14px rgba(102, 126, 234, 0.35)",
                    "&:hover": {
                      background: hasAudio
                        ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                        : "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                      boxShadow: hasAudio 
                        ? "0 6px 20px rgba(16, 185, 129, 0.45)"
                        : "0 6px 20px rgba(102, 126, 234, 0.45)",
                    },
                    "&:disabled": {
                      background: alpha("#9ca3af", 0.3),
                      color: alpha("#fff", 0.5),
                    },
                  }}
                />
              </Box>
            </Tooltip>
            
            <Tooltip 
              title={
                hasImage && !generatingImage
                  ? "✓ Image generated! Click to regenerate with different settings"
                  : generatingImage
                  ? "Generating image... please wait"
                  : "Generate image for video (optional but recommended)"
              }
            >
              <Box>
                <OperationButton
                  operation={{
                    provider: "stability",
                    operation_type: "image_generation",
                    actual_provider_name: "wavespeed",
                  }}
                  label={
                    hasImage && !generatingImage
                      ? "✓ Regenerate Image"
                      : generatingImage
                      ? "Generating Image..."
                      : "Generate Image"
                  }
                  variant="contained"
                  size="medium"
                  startIcon={
                    hasImage && !generatingImage ? (
                      <RefreshIcon />
                    ) : generatingImage ? (
                      <CircularProgress size={16} sx={{ color: "white" }} />
                    ) : (
                      <ImageIcon />
                    )
                  }
                  showCost={true}
                  checkOnHover={true}
                  checkOnMount={false}
                  onClick={hasImage ? handleRegenerateClick : () => handleGenerateImage()}
                  disabled={generatingImage}
                  loading={generatingImage}
                  sx={{
                    minWidth: { xs: '100%', sm: 180 },
                    background: hasImage 
                      ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    fontWeight: 600,
                    textTransform: "none",
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: { xs: 0.75, sm: 1 },
                    boxShadow: hasImage 
                      ? "0 4px 14px rgba(16, 185, 129, 0.35)"
                      : "0 4px 14px rgba(102, 126, 234, 0.35)",
                    "&:hover": {
                      background: hasImage
                        ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                        : "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                      boxShadow: hasImage 
                        ? "0 6px 20px rgba(16, 185, 129, 0.45)"
                        : "0 6px 20px rgba(102, 126, 234, 0.45)",
                    },
                    "&:disabled": {
                      background: alpha("#9ca3af", 0.3),
                      color: alpha("#fff", 0.5),
                    },
                  }}
                />
              </Box>
            </Tooltip>
            
            <Tooltip title={totalScenes && totalScenes <= 1 ? "Cannot delete the last scene" : "Delete this scene"}>
              <IconButton
                onClick={() => onDelete(scene.id)}
                disabled={approving || generating || (totalScenes !== undefined && totalScenes <= 1)}
                sx={{
                  color: "#ef4444",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 2,
                  padding: { xs: 1, sm: 1.5 },
                  alignSelf: { xs: 'center', sm: 'auto' },
                  "&:hover": {
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  },
                  "&:disabled": {
                    backgroundColor: "rgba(156, 163, 175, 0.1)",
                    borderColor: "rgba(156, 163, 175, 0.2)",
                    color: "#9ca3af",
                  },
                }}
              >
                <DeleteIcon sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" } }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: "rgba(15, 23, 42, 0.08)", borderWidth: 1 }} />

        <Stack spacing={2}>
          {scene.lines.map((line) => (
            <LineEditor key={line.id} line={line} onChange={updateLine} />
          ))}
        </Stack>

        {scene.audioUrl && (
          <>
            <Divider sx={{ borderColor: "rgba(15, 23, 42, 0.08)", borderWidth: 1, mt: 1 }} />
            <Box
              sx={{
                p: 2,
                background: hasAudio
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%)"
                  : "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.08) 100%)",
                borderRadius: 2,
                border: hasAudio
                  ? "1px solid rgba(16, 185, 129, 0.2)"
                  : "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                <VolumeUpIcon sx={{ color: hasAudio ? "#059669" : "#d97706", fontSize: "1.25rem" }} />
                <Typography variant="subtitle2" sx={{ color: hasAudio ? "#059669" : "#d97706", fontWeight: 600 }}>
                  {hasAudio ? "Audio Generated" : "Loading Audio..."}
                </Typography>
              </Stack>
              {hasAudio && audioBlobUrl ? (
                <audio controls style={{ width: "100%", borderRadius: 8 }}>
                  <source src={audioBlobUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} sx={{ color: "#d97706" }} />
                </Box>
              )}
            </Box>
          </>
        )}

        {/* Image Generation Progress - Show when generating */}
        {generatingImage && (
          <>
            <Divider sx={{ borderColor: "rgba(15, 23, 42, 0.08)", borderWidth: 1, mt: 1 }} />
            <Box
              sx={{
                p: 2,
                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
                borderRadius: 2,
                border: "1px solid rgba(102, 126, 234, 0.2)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                <ImageIcon sx={{ color: "#667eea", fontSize: "1.25rem" }} />
                <Typography variant="subtitle2" sx={{ color: "#667eea", fontWeight: 600 }}>
                  Generating Image...
                </Typography>
              </Stack>
              
              {/* Progress Bar */}
              <Box sx={{ mb: 1.5 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={imageGenerationProgress} 
                  sx={{ 
                    height: 8, 
                    borderRadius: 4,
                    backgroundColor: alpha("#667eea", 0.1),
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: "#667eea",
                      borderRadius: 4,
                    }
                  }} 
                />
                <Typography variant="caption" sx={{ color: "#667eea", mt: 0.5, display: "block", textAlign: "right" }}>
                  {imageGenerationProgress}%
                </Typography>
              </Box>
              
              {/* Status Message */}
              {imageGenerationStatus && (
                <Typography variant="body2" sx={{ color: "#667eea", fontSize: "0.875rem", lineHeight: 1.6, mb: 1 }}>
                  {imageGenerationStatus}
                </Typography>
              )}
              
              {/* Spinner */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", mt: 1 }}>
                <CircularProgress size={32} sx={{ color: "#667eea" }} />
              </Box>
            </Box>
          </>
        )}

        {/* Generated Image Display - Show when image exists and not generating */}
        {scene.imageUrl && !generatingImage && (
          <>
            <Divider sx={{ borderColor: "rgba(15, 23, 42, 0.08)", borderWidth: 1, mt: 1 }} />
            <Box
              sx={{
                p: 2,
                background: imageBlobUrl && !imageLoading
                  ? "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)"
                  : "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.08) 100%)",
                borderRadius: 2,
                border: imageBlobUrl && !imageLoading
                  ? "1px solid rgba(102, 126, 234, 0.2)"
                  : "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5, width: "100%" }}>
                <ImageIcon sx={{ color: imageBlobUrl && !imageLoading ? "#667eea" : "#d97706", fontSize: "1.25rem" }} />
                <Typography variant="subtitle2" sx={{ color: imageBlobUrl && !imageLoading ? "#667eea" : "#d97706", fontWeight: 600, flex: 1 }}>
                  {imageBlobUrl && !imageLoading ? "Image Generated" : "Loading Image..."}
                </Typography>
                {imageBlobUrl && !imageLoading && (
                  <Tooltip title="View full size">
                    <IconButton
                      size="small"
                      onClick={() => setShowImagePreview(true)}
                      sx={{
                        color: "#667eea",
                        "&:hover": { background: "rgba(102, 126, 234, 0.1)" },
                      }}
                    >
                      <FullscreenIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              {imageBlobUrl && !imageLoading ? (
                <Box
                  sx={{
                    width: "100%",
                    borderRadius: 2,
                    overflow: "hidden",
                    border: "1px solid rgba(102,126,234,0.2)",
                    background: alpha("#667eea", 0.05),
                  }}
                >
                  <Box
                    component="img"
                    src={imageBlobUrl}
                    alt={scene.title}
                    sx={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      maxHeight: 400,
                      objectFit: "contain",
                      background: "rgba(0,0,0,0.04)",
                    }}
                    onError={(e) => {
                      console.error('[SceneEditor] Image failed to load:', {
                        src: e.currentTarget.src,
                        imageUrl: scene.imageUrl,
                        imageBlobUrl,
                      });
                    }}
                    onLoad={() => {
                      console.log('[SceneEditor] Image loaded successfully');
                    }}
                  />
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} sx={{ color: "#d97706" }} />
                </Box>
              )}
            </Box>
          </>
        )}
      </Stack>

      {/* Image Regeneration Modal */}
      <ImageRegenerateModal
        open={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        onRegenerate={handleGenerateImage}
        initialPrompt={(() => {
          const promptParts = [
            `Scene: ${scene.title}`,
            "Professional podcast recording studio",
            "Modern microphone setup",
            "Clean background, professional lighting",
            "16:9 aspect ratio, video-optimized composition"
          ];
          if (idea) {
            promptParts.push(`Topic: ${idea.substring(0, 60)}`);
          }
          return promptParts.join(", ");
        })()}
        initialStyle="Realistic"
        initialRenderingSpeed="Quality"
        initialAspectRatio="16:9"
        isGenerating={generatingImage}
      />

      <AudioRegenerateModal
        open={showAudioModal}
        onClose={() => setShowAudioModal(false)}
        onRegenerate={handleAudioRegenerate}
        initialSettings={audioSettings}
        isGenerating={generating}
      />

      {/* Full-size Image Preview Modal */}
      <Dialog
        open={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        maxWidth="lg"
        PaperProps={{
          sx: {
            background: "rgba(0, 0, 0, 0.9)",
            borderRadius: 3,
            maxHeight: "90vh",
          }
        }}
      >
        <DialogContent sx={{ p: 0, position: "relative" }}>
          <IconButton
            onClick={() => setShowImagePreview(false)}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              color: "#fff",
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 1,
              "&:hover": { background: "rgba(0, 0, 0, 0.7)" },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            component="img"
            src={imageBlobUrl || ""}
            alt={scene.title}
            sx={{
              width: "100%",
              height: "auto",
              maxHeight: "85vh",
              objectFit: "contain",
              display: "block",
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Why Script Modal - Guidance for scene approval */}
      <Dialog
        open={showWhyScript}
        onClose={() => setShowWhyScript(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 2,
          }
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <HelpOutlineIcon sx={{ color: '#d97706', fontSize: '1.5rem' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a' }}>
                Why Approve This Scene?
              </Typography>
            </Box>
            <Divider />
            <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.7 }}>
              Each scene requires <strong>approval</strong> before audio can be generated. Here&apos;s why the approval process matters:
            </Typography>
            <Box sx={{ 
              p: 2, 
              background: 'rgba(245, 158, 11, 0.08)', 
              borderRadius: 2,
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: '#10b981', fontSize: '1.25rem' }} />
                  <Typography variant="body2" sx={{ color: '#059669', flex: 1 }}>
                    <strong>Script Accuracy:</strong> The AI generates audio based on the script text. Once approved, the text is locked to ensure consistency.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: '#10b981', fontSize: '1.25rem' }} />
                  <Typography variant="body2" sx={{ color: '#059669', flex: 1 }}>
                    <strong>Cost Control:</strong> Audio generation uses your subscription credits. Approving ensures you only pay for scenes you intend to render.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <CheckCircleIcon sx={{ color: '#10b981', fontSize: '1.25rem' }} />
                  <Typography variant="body2" sx={{ color: '#059669', flex: 1 }}>
                    <strong>Quality Check:</strong> Review your script for tone, pacing, and accuracy before spending credits on audio generation.
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
              Pro tip: You can always regenerate audio later with different voice settings after approval.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => setShowWhyScript(false)}>
                Got it
              </PrimaryButton>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </GlassyCard>
  );
};

