import React, { useState, useEffect } from "react";
import { Box, Stack, Typography, Alert, Paper, Chip, Divider, LinearProgress, CircularProgress, alpha, Modal, IconButton, Tooltip, Button } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import InfoIcon from '@mui/icons-material/Info';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { Scene, Job, VideoGenerationSettings } from "../types";
import { GlassyCard, glassyCardSx } from "../ui";
import { InlineAudioPlayer } from "../InlineAudioPlayer";
import { SceneActionButtons } from "./SceneActionButtons";
import { aiApiClient, getAuthTokenGetter } from "../../../api/client";
import { fetchMediaBlobUrl } from "../../../utils/fetchMediaBlobUrl";
import { mediaCache, getCachedMedia, setCachedMedia, hasCachedMedia } from "../../../utils/mediaCache";
import { VideoRegenerateModal } from "./VideoRegenerateModal";

interface SceneCardProps {
  scene: Scene;
  job?: Job;
  rendering: string | null;
  generatingImage: string | null;
  isBusy: boolean;
  totalScenes?: number;
  avatarImageUrl?: string | null;
  bible?: any;
  analysis?: any;
  onRender: (sceneId: string, mode: "preview" | "full") => void;
  onImageGenerate: (sceneId: string) => void;
  onVideoGenerate: (sceneId: string, settings: VideoGenerationSettings) => void;
  onDownloadAudio: (audioUrl: string, title: string) => void;
  onDownloadVideo: (videoUrl: string, title: string) => void;
  onShare: (audioUrl: string, title: string) => void;
  onDelete: (sceneId: string) => void;
  onError: (message: string) => void;
}

const getInitials = (title: string): string => {
  return title
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
};

const getStatusColor = (status: Job["status"]) => {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "running":
    case "previewing":
      return "info";
    default:
      return "default";
  }
};

const getStatusIcon = (status: Job["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircleIcon />;
    case "failed":
      return <InfoIcon />;
    case "running":
    case "previewing":
      return <CircularProgress size={16} />;
    default:
      return <RadioButtonUncheckedIcon />;
  }
};

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  job,
  rendering,
  generatingImage,
  isBusy,
  totalScenes,
  avatarImageUrl,
  bible,
  analysis,
  onRender,
  onImageGenerate,
  onVideoGenerate,
  onDownloadAudio,
  onDownloadVideo,
  onShare,
  onDelete,
  onError,
}) => {
  const hasAudio = Boolean(scene.audioUrl || job?.finalUrl || job?.previewUrl);
  const hasImage = Boolean(scene.imageUrl || job?.imageUrl);
  const hasVideo = Boolean(job?.videoUrl);
  const audioUrl = job?.finalUrl || job?.previewUrl || scene.audioUrl || "";
  const imageUrl = job?.imageUrl || scene.imageUrl || "";
  const status = job?.status || (hasAudio ? "completed" : "idle");
  const initials = getInitials(scene.title);


  // Load image as blob if it's an authenticated endpoint
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [initialVideoPrompt, setInitialVideoPrompt] = useState<string>("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Prepare a simple default prompt based on the scene title/description
  useEffect(() => {
    const baseTitle = (scene.title || "").trim();
    const description = (scene as any).description as string | undefined;
    const descSnippet = (description || "").split(".")[0]?.trim();
    let prompt = baseTitle;
    if (!prompt && descSnippet) {
      prompt = descSnippet;
    }
    if (!prompt) {
      prompt = "Professional podcast scene with subtle movement";
    }
    setInitialVideoPrompt(prompt);
  }, [scene]);
  
  useEffect(() => {
    if (!imageUrl) {
      setImageBlobUrl(null);
      setImageLoading(false);
      setImageError(null);
      return;
    }

    // Check cache first with scene context
    const cachedUrl = getCachedMedia(imageUrl, scene.id);
    if (cachedUrl) {
      if (process.env.NODE_ENV === 'development') console.log('[SceneCard] Using cached image:', imageUrl, `(scene: ${scene.id})`);
      setImageBlobUrl(cachedUrl);
      setImageLoading(false);
      setImageError(null);
      return;
    }

    // Check if this is a podcast image endpoint that requires authentication
    const isPodcastImage = imageUrl.includes('/api/podcast/images/') || imageUrl.includes('/api/story/images/');
    
    if (!isPodcastImage) {
      // Regular URL (external), use directly and cache it with scene context
      setImageBlobUrl(imageUrl);
      setCachedMedia(imageUrl, imageUrl, 'image', undefined, scene.id);
      setImageLoading(false);
      setImageError(null);
      return;
    }

    // Fetch as blob for authenticated endpoints
    let isMounted = true;
    const currentImageUrl = imageUrl;

    const loadImageBlob = async () => {
      try {
        setImageLoading(true);
        setImageError(null);
        if (process.env.NODE_ENV === 'development') console.log('[SceneCard] Loading image blob for:', currentImageUrl.split('?')[0]);
        
        // Check cache again in case it was loaded while we were waiting
        const cachedUrl = getCachedMedia(currentImageUrl, scene.id);
        if (cachedUrl) {
          if (isMounted) {
            setImageBlobUrl(cachedUrl);
            setImageLoading(false);
            setImageError(null);
          }
          return;
        }
        
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
        
        if (!isMounted || imageUrl !== currentImageUrl) {
          return;
        }
        
        const blob = response.data;
        const newBlobUrl = URL.createObjectURL(blob);
        
        // Cache the blob URL with scene context
        setCachedMedia(currentImageUrl, newBlobUrl, 'image', blob.size, scene.id);
        
        setImageBlobUrl((prevBlobUrl) => {
          // Clean up previous blob URL if exists
          if (prevBlobUrl && prevBlobUrl !== newBlobUrl && prevBlobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(prevBlobUrl);
          }
          return newBlobUrl;
        });
        if (process.env.NODE_ENV === 'development') console.log('[SceneCard] Image blob loaded and cached successfully:', currentImageUrl.split('?')[0]);
      } catch (err) {
        console.error('[SceneCard] Failed to load image blob:', err);
        if (isMounted && imageUrl === currentImageUrl) {
          // Try adding query token as fallback
          try {
            // Normalize path again for fallback
            let fallbackPath = currentImageUrl.startsWith('/') ? currentImageUrl : `/${currentImageUrl}`;
            
            // Convert /api/story/images/ to /api/podcast/images/ if needed
            if (fallbackPath.includes('/api/story/images/')) {
              const filename = fallbackPath.split('/api/story/images/').pop() || '';
              fallbackPath = `/api/podcast/images/${filename}`;
            }
            
            // Ensure it's a podcast image endpoint
            if (!fallbackPath.includes('/api/podcast/images/')) {
              const filename = fallbackPath.split('/').pop() || currentImageUrl;
              fallbackPath = `/api/podcast/images/${filename}`;
            }

            // Remove query parameters if present
            fallbackPath = fallbackPath.split('?')[0];

            // Get auth token from localStorage or use aiApiClient's default token
            const token = localStorage.getItem('clerk_dashboard_token') || '';
            if (token) {
              const urlWithToken = `${fallbackPath}?token=${encodeURIComponent(token)}`;
              setImageBlobUrl(urlWithToken);
              setCachedMedia(currentImageUrl, urlWithToken, 'image', undefined, scene.id);
            } else {
              // Fallback to original URL
              setImageBlobUrl(imageUrl);
              setCachedMedia(currentImageUrl, imageUrl, 'image', undefined, scene.id);
            }
          } catch (fallbackErr) {
            console.error('[SceneCard] Image fallback failed:', fallbackErr);
            setImageBlobUrl(null);
            setImageError('Failed to load image');
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
  }, [imageUrl, hasImage, scene.id]);

  // Load video as blob when videoUrl changes (using Story Writer's utility)
  useEffect(() => {
    if (!job?.videoUrl) {
      setVideoBlobUrl(null);
      setVideoLoading(false);
      setVideoError(null);
      return;
    }

    // Check cache first with scene context
    const cachedUrl = getCachedMedia(job.videoUrl, scene.id);
    if (cachedUrl) {
      if (process.env.NODE_ENV === 'development') console.log('[SceneCard] Using cached video:', job.videoUrl?.split('?')[0], `(scene: ${scene.id})`);
      setVideoBlobUrl(cachedUrl);
      setVideoLoading(false);
      setVideoError(null);
      return;
    }

    let currentBlobUrl: string | null = null;
    let retryCount = 0;
    const maxRetries = 3;

    const loadVideoBlob = async () => {
      try {
        setVideoLoading(true);
        setVideoError(null);
        
        // Check cache again in case it was loaded while we were waiting
        const cachedUrl = getCachedMedia(job.videoUrl!, scene.id);
        if (cachedUrl) {
          setVideoBlobUrl(cachedUrl);
          setVideoLoading(false);
          setVideoError(null);
          return;
        }
        
        if (process.env.NODE_ENV === 'development') console.log('[SceneCard] Loading video blob for:', (job.videoUrl || '').split('?')[0]);
        const blobUrl = await fetchMediaBlobUrl(job.videoUrl!);
        
        if (blobUrl) {
          // Validate the blob URL by checking if it's a valid blob
          if (blobUrl.startsWith('blob:')) {
            // Test the blob by trying to load it as a video
            const testVideo = document.createElement('video');
            testVideo.src = blobUrl;
            
            // Wait for metadata to load to validate the blob
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                testVideo.onerror = null;
                testVideo.onloadedmetadata = null;
                reject(new Error('Video validation timeout'));
              }, 5000);
              
              testVideo.onloadedmetadata = () => {
                clearTimeout(timeout);
                if (process.env.NODE_ENV === 'development') console.log('[SceneCard] Video blob validation successful:', {
                  duration: testVideo.duration,
                  videoWidth: testVideo.videoWidth,
                  videoHeight: testVideo.videoHeight,
                });
                resolve(true);
              };
              
              testVideo.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error('Video blob validation failed'));
              };
            });
            
            // If we get here, the blob is valid
            currentBlobUrl = blobUrl;
            setVideoBlobUrl(blobUrl);
            
            // Cache the validated blob URL with scene context
            setCachedMedia(job.videoUrl!, blobUrl, 'video', undefined, scene.id);
            
            if (process.env.NODE_ENV === 'development') console.log('[SceneCard] Video blob loaded, validated, and cached successfully:', (job.videoUrl || '').split('?')[0]);
          } else {
            // Direct URL fallback
            setVideoBlobUrl(blobUrl);
            setCachedMedia(job.videoUrl!, blobUrl, 'video', undefined, scene.id);
            console.log('[SceneCard] Using direct URL fallback and caching:', blobUrl);
          }
        } else {
          // File not found (404) - clear the blob URL
          console.warn('[SceneCard] Video file not found (404):', job.videoUrl);
          setVideoBlobUrl(null);
          setVideoError('Video file not found on server');
        }
      } catch (err) {
        console.error('[SceneCard] Failed to load video blob:', err);
        setVideoBlobUrl(null);
        
        // Retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[SceneCard] Retrying video blob load (${retryCount}/${maxRetries})`);
          setTimeout(loadVideoBlob, 1000 * retryCount); // Exponential backoff
        } else {
          console.error('[SceneCard] Max retries reached, trying authenticated direct URL');
          // Fallback to authenticated direct URL
          try {
            // Get auth token using the same method as aiApiClient
            const authTokenGetter = getAuthTokenGetter();
            if (authTokenGetter && job.videoUrl) {
              const token = await authTokenGetter();
              if (token) {
                const separator = job.videoUrl.includes('?') ? '&' : '?';
                const authenticatedUrl = `${job.videoUrl}${separator}token=${encodeURIComponent(token)}`;
                setVideoBlobUrl(authenticatedUrl);
                setCachedMedia(job.videoUrl!, authenticatedUrl, 'video', undefined, scene.id);
                console.log('[SceneCard] Using authenticated direct URL fallback and caching');
              } else {
                setVideoBlobUrl(job.videoUrl || null);
                setCachedMedia(job.videoUrl!, job.videoUrl || '', 'video', undefined, scene.id);
                setVideoError('Failed to load video after multiple attempts');
              }
            } else {
              setVideoBlobUrl(job.videoUrl || null);
              setCachedMedia(job.videoUrl!, job.videoUrl || '', 'video', undefined, scene.id);
              setVideoError('Failed to load video after multiple attempts');
            }
          } catch (fallbackErr) {
            console.error('[SceneCard] Fallback authentication failed:', fallbackErr);
            setVideoBlobUrl(null);
            setVideoError('Failed to load video. Please try refreshing the page.');
          }
        }
      } finally {
        setVideoLoading(false);
      }
    };

    loadVideoBlob();

    return () => {
      // Cleanup blob URL when component unmounts or URL changes
      if (currentBlobUrl && currentBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [job?.videoUrl]);

  return (
    <GlassyCard sx={glassyCardSx}>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Visual Avatar */}
          <Paper
            sx={{
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "1.1rem",
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(102, 126, 234, 0.25)",
            }}
          >
            {initials}
          </Paper>

          {/* Title and Metadata */}
          <Box flex={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Typography variant="h6" sx={{ color: "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>
                {scene.title}
              </Typography>
              
              {/* Quick Downloads */}
              <Stack direction="row" spacing={1.5} alignItems="center">
                {job?.finalUrl && (
                  <Box
                    component="a"
                    href={job.finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ 
                      color: "#64748b", 
                      textDecoration: "none", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 0.5,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      "&:hover": { color: "#6366f1" }
                    }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                    Audio
                  </Box>
                )}
                {hasVideo && videoBlobUrl && (
                  <Box
                    component="a"
                    href={videoBlobUrl}
                    download={`${scene.title.replace(/[^a-z0-9]/gi, '_')}_video.mp4`}
                    sx={{ 
                      color: "#64748b", 
                      textDecoration: "none", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 0.5,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      "&:hover": { color: "#6366f1" }
                    }}
                  >
                    <VideocamIcon sx={{ fontSize: 14 }} />
                    Video
                  </Box>
                )}
              </Stack>
            </Stack>

            {/* Compact Metadata Row */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.5 }} useFlexGap>
              {/* Scene ID */}
              <Chip 
                label={`Scene ${scene.id.slice(-4)}`} 
                size="small" 
                sx={{ 
                  height: 20, 
                  fontSize: "0.7rem", 
                  background: alpha("#64748b", 0.08), 
                  color: "#64748b",
                  fontWeight: 600 
                }} 
              />
              
              {/* Audio Status */}
              <Chip
                label={hasAudio ? "Audio Ready" : "Needs Audio"}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  background: hasAudio ? alpha("#10b981", 0.1) : alpha("#f59e0b", 0.1),
                  color: hasAudio ? "#059669" : "#d97706",
                  fontWeight: 700,
                  border: "1px solid",
                  borderColor: hasAudio ? alpha("#10b981", 0.2) : alpha("#f59e0b", 0.2),
                }}
              />

              {/* Cost */}
              {job?.cost != null && (
                <Chip
                  label={`$${job.cost.toFixed(2)}`}
                  size="small"
                  sx={{ 
                    height: 20,
                    fontSize: "0.7rem",
                    background: alpha("#6366f1", 0.08), 
                    color: "#6366f1",
                    fontWeight: 600
                  }}
                />
              )}

              {/* Job Status (if active/failed) */}
              {job && job.status !== "idle" && (
                <Chip
                  icon={getStatusIcon(status)}
                  label={status.charAt(0).toUpperCase() + status.slice(1)}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    background: status === "completed" ? alpha("#10b981", 0.1) : status === "failed" ? alpha("#ef4444", 0.1) : alpha("#3b82f6", 0.1),
                    color: status === "completed" ? "#059669" : status === "failed" ? "#dc2626" : "#2563eb",
                    fontWeight: 700,
                    "& .MuiChip-icon": { fontSize: 14, color: "inherit" }
                  }}
                />
              )}
            </Stack>
          </Box>
        </Stack>

        {/* Audio Player - Now directly in header section (visual integration) */}
        {hasAudio && audioUrl && (
          <Box sx={{ width: "100%", mt: 1 }}>
            <InlineAudioPlayer audioUrl={audioUrl} title={scene.title} />
          </Box>
        )}

        {/* Progress Bar */}
        {job && job.status !== "idle" && job.status !== "completed" && (
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {job.progress}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={job.progress}
              sx={{
                height: 8,
                borderRadius: 4,
                background: alpha("#fff", 0.1),
                "& .MuiLinearProgress-bar": {
                  background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                },
              }}
            />
          </Box>
        )}

        <Divider sx={{ borderColor: "rgba(15, 23, 42, 0.08)" }} />

        {/* Video Preview - Show video if available, otherwise show image */}
        {hasVideo ? (
          <Box
            sx={{
              width: "100%",
              borderRadius: 2,
              overflow: "hidden",
              border: videoError ? "2px solid rgba(239, 68, 68, 0.5)" : "2px solid rgba(56,189,248,0.5)",
              background: alpha("#0f172a", 0.85),
              position: "relative",
            }}
          >
            {videoLoading && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.7)",
                  zIndex: 1,
                }}
              >
                <CircularProgress size={40} sx={{ color: "#38bdf8" }} />
              </Box>
            )}
            
            {videoError && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.8)",
                  zIndex: 1,
                  p: 2,
                }}
              >
                <Typography variant="body2" sx={{ color: "#ef4444", textAlign: "center", mb: 1 }}>
                  {videoError}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setVideoError(null);
                    // Retry loading
                    if (job?.videoUrl) {
                      setVideoBlobUrl(null);
                      // This will trigger the useEffect to reload
                      setTimeout(() => {
                        if (job.videoUrl) {
                          setVideoBlobUrl(job.videoUrl);
                        }
                      }, 100);
                    }
                  }}
                  sx={{ color: "#38bdf8", borderColor: "#38bdf8" }}
                >
                  Retry
                </Button>
              </Box>
            )}

            {videoBlobUrl && !videoLoading && !videoError && (
              <Box
                component="video"
                src={videoBlobUrl}
                controls
                preload="metadata"
                sx={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  maxHeight: 420,
                  objectFit: "contain",
                  backgroundColor: "black",
                }}
                onError={async (e) => {
                  const videoElement = e.currentTarget as HTMLVideoElement;
                  console.error("[SceneCard] Video failed to load:", {
                    originalUrl: job?.videoUrl,
                    blobUrl: videoBlobUrl,
                    networkState: videoElement.networkState,
                    errorCode: videoElement.error?.code,
                    errorMessage: videoElement.error?.message,
                  });

                  // If blob URL failed, try fallback to authenticated direct URL
                  if (videoBlobUrl && videoBlobUrl.startsWith('blob:')) {
                    console.log('[SceneCard] Blob URL failed, trying authenticated direct URL fallback');
                    try {
                      const authTokenGetter = getAuthTokenGetter();
                      if (authTokenGetter && job?.videoUrl) {
                        const token = await authTokenGetter();
                        if (token) {
                          const separator = job.videoUrl.includes('?') ? '&' : '?';
                          const authenticatedUrl = `${job.videoUrl}${separator}token=${encodeURIComponent(token)}`;
                          setVideoBlobUrl(authenticatedUrl);
                        } else {
                          setVideoBlobUrl(null);
                          setVideoError('Failed to load video. Authentication required.');
                        }
                      } else {
                        setVideoBlobUrl(null);
                        setVideoError('Failed to load video. Authentication required.');
                      }
                    } catch (fallbackErr) {
                      console.error('[SceneCard] Auth fallback failed:', fallbackErr);
                      setVideoBlobUrl(null);
                      setVideoError('Failed to load video. Please try refreshing the page.');
                    }
                  } else if (videoBlobUrl && videoBlobUrl.includes('token=')) {
                    // If authenticated URL also failed, show error to user
                    console.error('[SceneCard] Both blob and authenticated URL failed');
                    setVideoError('Video file could not be loaded. The file may be corrupted or access was denied.');
                  } else {
                    // If direct URL failed, try authenticated version
                    if (job?.videoUrl) {
                      try {
                        const authTokenGetter = getAuthTokenGetter();
                        if (authTokenGetter) {
                          const token = await authTokenGetter();
                          if (token) {
                            const separator = job.videoUrl.includes('?') ? '&' : '?';
                            const authenticatedUrl = `${job.videoUrl}${separator}token=${encodeURIComponent(token)}`;
                            setVideoBlobUrl(authenticatedUrl);
                            console.log('[SceneCard] Trying authenticated URL as fallback');
                          } else {
                            setVideoBlobUrl(null);
                            setVideoError('Failed to load video. Authentication required.');
                          }
                        } else {
                          setVideoBlobUrl(null);
                          setVideoError('Failed to load video. Authentication required.');
                        }
                      } catch (fallbackErr) {
                        console.error('[SceneCard] Final fallback failed:', fallbackErr);
                        setVideoBlobUrl(null);
                        setVideoError('Failed to load video. Please try refreshing the page.');
                      }
                    } else {
                      setVideoError('Failed to load video. No video URL available.');
                    }
                  }
                }}
              />
            )}
          </Box>
        ) : hasImage ? (
          <Box sx={{ position: "relative", width: "100%" }}>
            <Box
              sx={{
                width: "100%",
                borderRadius: 2,
                overflow: "hidden",
                border: imageError ? "2px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(102,126,234,0.2)",
                background: alpha("#667eea", 0.05),
                cursor: "pointer",
                "&:hover .zoom-icon": {
                  opacity: 1,
                }
              }}
              onClick={() => !imageLoading && !imageError && setShowImageModal(true)}
            >
              {imageLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.7)",
                    zIndex: 1,
                    minHeight: 200,
                  }}
                >
                  <CircularProgress size={40} sx={{ color: "#38bdf8" }} />
                </Box>
              )}
              
              {imageError && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.8)",
                    zIndex: 1,
                    p: 2,
                    minHeight: 200,
                  }}
                >
                  <Typography variant="body2" sx={{ color: "#ef4444", textAlign: "center", mb: 1 }}>
                    {imageError}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setImageError(null);
                      // Retry loading
                      if (imageUrl) {
                        setImageBlobUrl(null);
                        setTimeout(() => setImageBlobUrl(imageUrl), 100);
                      }
                    }}
                    sx={{ color: "#38bdf8", borderColor: "#38bdf8" }}
                  >
                    Retry
                  </Button>
                </Box>
              )}

              {imageBlobUrl && !imageLoading && !imageError && (
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
                    background: "#000",
                  }}
                  onError={(e) => {
                    console.error("[SceneCard] Image failed to load:", {
                      src: e.currentTarget.src,
                      imageUrl,
                    });
                    setImageError('Failed to load image');
                  }}
                />
              )}
              
              <Box
                className="zoom-icon"
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  bgcolor: "rgba(0,0,0,0.6)",
                  color: "white",
                  borderRadius: "50%",
                  p: 1.5,
                  opacity: 0,
                  transition: "opacity 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ZoomInIcon sx={{ fontSize: 32 }} />
              </Box>
            </Box>
          </Box>
        ) : null}

        {/* Action Buttons */}
        <SceneActionButtons
          scene={scene}
          job={job}
          hasAudio={hasAudio}
          hasImage={hasImage}
          hasVideo={hasVideo}
          audioUrl={audioUrl}
          rendering={rendering}
          generatingImage={generatingImage}
          isBusy={isBusy}
          totalScenes={totalScenes}
          onRender={onRender}
          onImageGenerate={onImageGenerate}
          onVideoRender={() => setShowVideoModal(true)}
          onDownloadAudio={onDownloadAudio}
          onDownloadVideo={onDownloadVideo}
          onShare={onShare}
          onDelete={onDelete}
          onError={onError}
        />

        {/* Video Generation Settings Modal */}
        <VideoRegenerateModal
          open={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          onGenerate={(settings: VideoGenerationSettings) => {
            setShowVideoModal(false);
            onVideoGenerate(scene.id, settings);
          }}
          initialPrompt={initialVideoPrompt}
          initialResolution="480p"
          initialSeed={-1}
          sceneTitle={scene.title}
          bible={bible}
          analysis={analysis}
        />
      </Stack>
    </GlassyCard>
  );
};

