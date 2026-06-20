import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Typography, Stack, Button, CircularProgress, Alert, Avatar,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import VideoCameraFront from '@mui/icons-material/VideoCameraFront';
import SkipNext from '@mui/icons-material/SkipNext';
import PlayArrow from '@mui/icons-material/PlayArrow';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Undo from '@mui/icons-material/Undo';
import { createAvatarVideoAsync } from '../../../../../api/videoStudioApi';
import { useVideoGenerationPolling } from '../../../../../hooks/usePolling';
import { fetchMediaBlobUrl } from '../../../../../utils/fetchMediaBlobUrl';
import { getAuthTokenGetter, getApiUrl } from '../../../../../api/client';
import { VideoGenerationLoader } from '../../../../shared/VideoGenerationLoader';
import { OperationButton } from '../../../../shared/OperationButton';

const STORAGE_KEY = 'test_persona_video_url';
const STORAGE_BACKUP_KEY = 'test_persona_video_url_backup';

interface VideoTabProps {
  avatarUrl: string;
  voiceUrl: string;
  onVideoGenerated?: (url: string | null) => void;
  onClose?: () => void;
}

export const VideoTab: React.FC<VideoTabProps> = ({
  avatarUrl,
  voiceUrl,
  onVideoGenerated,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [model, setModel] = useState<'infinitetalk' | 'hunyuan-avatar'>('infinitetalk');
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null);
  const [authenticatedVoiceUrl, setAuthenticatedVoiceUrl] = useState<string | null>(null);

  // Authenticated voice URL
  useEffect(() => {
    if (!voiceUrl || !voiceUrl.includes('/api/')) {
      setAuthenticatedVoiceUrl(voiceUrl || null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tokenGetter = getAuthTokenGetter();
        if (tokenGetter) {
          const token = await tokenGetter();
          if (token && !cancelled) {
            const absoluteUrl = voiceUrl.startsWith('/') ? `${getApiUrl()}${voiceUrl}` : voiceUrl;
            const sep = absoluteUrl.includes('?') ? '&' : '?';
            setAuthenticatedVoiceUrl(`${absoluteUrl}${sep}token=${encodeURIComponent(token)}`);
            return;
          }
        }
      } catch { /* fallback */ }
      if (!cancelled) setAuthenticatedVoiceUrl(voiceUrl);
    })();
    return () => { cancelled = true; };
  }, [voiceUrl]);

  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && saved !== 'undefined' && saved !== 'null' && saved.length > 0 ? saved : null;
    } catch (e) {
      console.warn('Failed to read video URL from localStorage', e);
      return null;
    }
  });

  const [archivedVideoUrl, setArchivedVideoUrl] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BACKUP_KEY);
      return saved && saved !== 'undefined' && saved !== 'null' && saved.length > 0 ? saved : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (generatedVideoUrl) {
        localStorage.setItem(STORAGE_KEY, generatedVideoUrl);
      }
      if (onVideoGenerated) {
        onVideoGenerated(generatedVideoUrl);
      }
    } catch (e) {
      console.warn('Failed to save video URL to localStorage', e);
    }
  }, [generatedVideoUrl, onVideoGenerated]);

  useEffect(() => {
    try {
      if (archivedVideoUrl) {
        localStorage.setItem(STORAGE_BACKUP_KEY, archivedVideoUrl);
      } else {
        localStorage.removeItem(STORAGE_BACKUP_KEY);
      }
    } catch (e) {
      console.warn('Failed to save archived voice url to localStorage', e);
    }
  }, [archivedVideoUrl]);

  const handleComplete = useCallback((res: any) => {
    setSuccess('Video generated successfully!');
    if (res?.video_url) {
      setGeneratedVideoUrl(res.video_url);
      setArchivedVideoUrl(null);
    }
    setLoading(false);
  }, []);

  const handleReDo = () => {
    if (generatedVideoUrl) setArchivedVideoUrl(generatedVideoUrl);
    setGeneratedVideoUrl(null);
    setSuccess(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleRestore = () => {
    if (archivedVideoUrl) {
      setGeneratedVideoUrl(archivedVideoUrl);
      setArchivedVideoUrl(null);
      setSuccess('Restored previous video');
    }
  };

  const handleError = useCallback((err: string) => {
    setError(`Generation failed: ${err}`);
    setLoading(false);
  }, []);

  const { startPolling, stopPolling, isPolling } = useVideoGenerationPolling({
    onComplete: handleComplete,
    onError: handleError
  });

  const operation = useMemo(() => ({
    provider: 'video',
    operation_type: 'avatar_video',
    actual_provider_name: 'alwrity',
    model: model,
  }), [model]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setGeneratedVideoUrl(null);

    try {
      let avatarBlob: Blob;
      try {
        const avatarBlobUrl = await fetchMediaBlobUrl(avatarUrl);
        if (avatarBlobUrl) {
          avatarBlob = await fetch(avatarBlobUrl).then(r => r.blob());
        } else {
          avatarBlob = await fetch(avatarUrl).then(r => r.blob());
        }
      } catch {
        avatarBlob = await fetch(avatarUrl).then(r => r.blob());
      }

      let voiceBlob: Blob;
      try {
        const voiceBlobUrl = await fetchMediaBlobUrl(voiceUrl);
        if (voiceBlobUrl) {
          voiceBlob = await fetch(voiceBlobUrl).then(r => r.blob());
        } else {
          voiceBlob = await fetch(voiceUrl).then(r => r.blob());
        }
      } catch {
        voiceBlob = await fetch(voiceUrl).then(r => r.blob());
      }

      const avatarFile = new File([avatarBlob], "avatar.png", { type: avatarBlob.type });
      const voiceFile = new File([voiceBlob], "voice_sample.wav", { type: voiceBlob.type });

      const resp = await createAvatarVideoAsync(avatarFile, voiceFile, '720p', model);

      if (resp.task_id) {
        startPolling(resp.task_id);
      } else {
        throw new Error("No task ID received from service");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to start video generation");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (onClose) onClose();
  };

  // Avatar blob URL for display
  useEffect(() => {
    if (!avatarUrl || avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:')) {
      setAvatarBlobUrl(null);
      return;
    }
    const isInternal =
      avatarUrl.includes('/api/podcast/') ||
      avatarUrl.includes('/api/youtube/') ||
      avatarUrl.includes('/api/story/') ||
      (avatarUrl.startsWith('/') && !avatarUrl.startsWith('//'));
    if (!isInternal) {
      setAvatarBlobUrl(null);
      return;
    }
    let isMounted = true;
    const currentAvatarUrl = avatarUrl;
    const loadAvatarBlob = async () => {
      try {
        const blobUrl = await fetchMediaBlobUrl(currentAvatarUrl);
        if (!isMounted || avatarUrl !== currentAvatarUrl) {
          if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
          return;
        }
        setAvatarBlobUrl(prev => {
          if (prev && prev !== blobUrl && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return blobUrl;
        });
      } catch {
        if (isMounted && avatarUrl === currentAvatarUrl) setAvatarBlobUrl(null);
      }
    };
    loadAvatarBlob();
    return () => {
      isMounted = false;
      setAvatarBlobUrl(prev => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [avatarUrl]);

  return (
    <>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center', fontSize: '1rem' }}>
        Combine your <strong>Brand Avatar</strong> and <strong>Voice Clone</strong> to generate a test intro video.
      </Typography>

      {loading ? (
        <VideoGenerationLoader />
      ) : generatedVideoUrl ? (
        <Box sx={{ width: '100%', mt: 2 }}>
          <Box sx={{
            width: '100%',
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            border: '1px solid #e2e8f0',
            position: 'relative',
            bgcolor: '#000'
          }}>
            <video controls src={generatedVideoUrl} style={{ width: '100%', display: 'block', maxHeight: '50vh' }} autoPlay />
            <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
              <Button
                variant="contained"
                onClick={handleReDo}
                startIcon={<RestartAlt />}
                size="small"
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  color: 'white',
                  borderRadius: '50px',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' },
                }}
              >
                ReDo
              </Button>
            </Box>
          </Box>
          <Box sx={{ p: 1.5, mt: 1, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Typography variant="body2" color="#166534" fontWeight={600}>
              Video generated successfully!
            </Typography>
          </Box>
        </Box>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch" justifyContent="center">
          <Stack spacing={2} flex={1} alignItems="center" sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={avatarBlobUrl || avatarUrl}
                sx={{ width: 110, height: 110, border: '4px solid #ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Box sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: '#10b981', color: 'white', p: 0.5, borderRadius: '50%', border: '2px solid white' }}>
                <VideoCameraFront fontSize="small" />
              </Box>
            </Box>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary">Your Brand Avatar</Typography>
            <Box sx={{ width: '100%', bgcolor: '#ffffff', p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block', color: '#64748b' }}>
                Voice Preview
              </Typography>
              <audio controls src={authenticatedVoiceUrl || undefined} style={{ width: '100%', height: 32 }} />
            </Box>
          </Stack>
          <Stack spacing={2} flex={1}>
            {archivedVideoUrl && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Undo />}
                onClick={handleRestore}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderStyle: 'dashed',
                  borderColor: '#3b82f6',
                  color: '#2563eb',
                  bgcolor: '#eff6ff',
                  '&:hover': { borderStyle: 'solid', bgcolor: '#dbeafe' }
                }}
              >
                Restore Last Generated Video
              </Button>
            )}
            <Box sx={{ width: '100%', p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
              <FormControl component="fieldset" fullWidth>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                  <FormLabel component="legend" sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#0f172a' }}>
                    Select Avatar Model
                  </FormLabel>
                  <Tooltip title="Choose the AI model that best fits your video duration needs. InfiniteTalk is recommended for most use cases.">
                    <InfoOutlined fontSize="small" color="action" sx={{ cursor: 'help' }} />
                  </Tooltip>
                </Stack>
                <RadioGroup
                  aria-label="avatar-model"
                  name="avatar-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as any)}
                >
                  <Tooltip title="Best for long-form content. Features natural head movements and lip-sync." placement="left" arrow>
                    <FormControlLabel
                      value="infinitetalk"
                      control={<Radio size="small" />}
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={600} color="#0f172a">InfiniteTalk (Default)</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">Specialized for talking heads, up to 10 mins</Typography>
                        </Box>
                      }
                      sx={{ mb: 1, alignItems: 'flex-start', '&:hover': { bgcolor: '#f8fafc' }, p: 1, borderRadius: 1, ml: -1, width: '100%' }}
                    />
                  </Tooltip>
                  <Tooltip title="Alternative high-quality model, optimized for shorter clips." placement="left" arrow>
                    <FormControlLabel
                      value="hunyuan-avatar"
                      control={<Radio size="small" />}
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={600} color="#0f172a">Hunyuan Avatar</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">Alternative model, supports up to 2 minutes</Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', '&:hover': { bgcolor: '#f8fafc' }, p: 1, borderRadius: 1, ml: -1, width: '100%' }}
                    />
                  </Tooltip>
                </RadioGroup>
              </FormControl>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'center' }}>
                <Button
                  size="small"
                  startIcon={<InfoOutlined />}
                  onClick={() => setShowCapabilities(true)}
                  sx={{ textTransform: 'none', color: 'primary.main', fontWeight: 500 }}
                >
                  Know Alwrity Video Capabilities
                </Button>
              </Box>
            </Box>
          </Stack>
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ width: '100%', mt: 2 }}>{error}</Alert>}
      {success && !generatedVideoUrl && <Alert severity="success" sx={{ width: '100%', mt: 2 }}>{success}</Alert>}

      {/* Hidden trigger button so the parent can call handleGenerate from the modal footer */}
      <Button
        ref={(btn) => { if (btn) (window as any).__testVideoGenerate = () => handleGenerate(); }}
        sx={{ display: 'none' }}
        data-testid="test-video-generate-trigger"
      />
    </>
  );
};

export default VideoTab;
