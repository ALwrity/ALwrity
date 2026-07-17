import React, { useState, useCallback, useRef } from 'react';
import {
  Paper,
  IconButton,
  Typography,
  Button,
  Slider,
  Box,
  Chip,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VideocamIcon from '@mui/icons-material/Videocam';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Frame, GifResult } from './types';
import { generateGif } from './gifMakerApi';

interface GifMakerFloatingPanelProps {
  open: boolean;
  onClose: () => void;
  apiBaseUrl?: string;
}

export const GifMakerFloatingPanel: React.FC<GifMakerFloatingPanelProps> = ({
  open,
  onClose,
  apiBaseUrl = '',
}) => {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [duration, setDuration] = useState(1500);
  const [maxWidth, setMaxWidth] = useState(800);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GifResult | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const captureFrame = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Screen capture is not supported in this browser');
      return;
    }
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        preferCurrentTab: true,
      } as any);
      streamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      videoRef.current = video;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);

      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `frame-${Date.now()}.png`, { type: 'image/png' });
        setFrames((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            file,
            thumbnail: URL.createObjectURL(blob),
            width: canvas.width,
            height: canvas.height,
          },
        ]);
      }, 'image/png');
    } catch (err) {
      if ((err as DOMException)?.name === 'NotAllowedError') return;
      console.error('Screen capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const removeFrame = useCallback((id: string) => {
    setFrames((prev) => {
      const frame = prev.find((f) => f.id === id);
      if (frame) URL.revokeObjectURL(frame.thumbnail);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (frames.length < 2) {
      alert('Need at least 2 frames to create a GIF');
      return;
    }
    setIsGenerating(true);
    setResult(null);
    try {
      const gifResult = await generateGif({
        frames: frames.map((f) => f.file),
        settings: { duration, endFrameDelay: 3000, maxWidth, loop: true, sharedPalette: true, optimizeLevel: 0 },
        apiBaseUrl,
      });
      setResult(gifResult);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [frames, duration, maxWidth, apiBaseUrl]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = 'ui-flow.gif';
    a.click();
  }, [result]);

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        width: 380,
        maxHeight: '80vh',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'inherit',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
            <VideocamIcon sx={{ fontSize: 18, color: '#16a34a' }} />
            GIF Maker
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: '#64748b' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Capture button */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={captureFrame}
            disabled={isCapturing}
            startIcon={isCapturing ? <CircularProgress size={16} color="inherit" /> : <VideocamIcon />}
            sx={{
              bgcolor: '#16a34a',
              '&:hover': { bgcolor: '#15803d' },
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 2,
              py: 1,
            }}
          >
            {isCapturing ? 'Select tab to capture...' : `Capture Frame (${frames.length})`}
          </Button>
        </Box>

        {/* Frame list */}
        {frames.length > 0 && (
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9', maxHeight: 200, overflowY: 'auto' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Frames ({frames.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {frames.map((frame, i) => (
                <Box key={frame.id} sx={{ position: 'relative', width: 64, height: 64, borderRadius: 1.5, overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                  <img src={frame.thumbnail} alt={`Frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <IconButton
                    size="small"
                    onClick={() => removeFrame(frame.id)}
                    sx={{ position: 'absolute', top: 1, right: 1, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', width: 18, height: 18, '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                  >
                    <DeleteIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                  <Chip label={String(i + 1)} size="small" sx={{ position: 'absolute', bottom: 2, left: 2, height: 16, minWidth: 16, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff' }} />
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Settings */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Settings
          </Typography>
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: '#475569' }}>Frame duration</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{duration}ms</Typography>
            </Box>
            <Slider
              size="small"
              value={duration}
              onChange={(_, v) => setDuration(v as number)}
              min={100}
              max={10000}
              step={100}
              sx={{ color: '#16a34a', '& .MuiSlider-thumb': { width: 14, height: 14 } }}
            />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: '#475569' }}>Max width</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{maxWidth}px</Typography>
            </Box>
            <Slider
              size="small"
              value={maxWidth}
              onChange={(_, v) => setMaxWidth(v as number)}
              min={200}
              max={1920}
              step={100}
              sx={{ color: '#16a34a', '& .MuiSlider-thumb': { width: 14, height: 14 } }}
            />
          </Box>
        </Box>

        {/* Generate / Result */}
        <Box sx={{ px: 2, py: 1.5 }}>
          {result ? (
            <Box>
              <Box sx={{ mb: 1, borderRadius: 2, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <img src={result.url} alt="GIF preview" style={{ width: '100%', display: 'block' }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                {result.width && <Chip label={`${result.width}×${result.height}`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                <Chip label={`${result.numFrames} frames`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                <Chip label={`${(result.sizeBytes / 1024).toFixed(1)} KB`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleDownload}
                  startIcon={<DownloadIcon />}
                  sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 600, fontSize: 13, borderRadius: 2 }}
                >
                  Download GIF
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => { setResult(null); setFrames([]); }}
                  sx={{ textTransform: 'none', fontSize: 13, borderRadius: 2, color: '#64748b', borderColor: '#cbd5e1' }}
                >
                  New
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              variant="contained"
              fullWidth
              onClick={handleGenerate}
              disabled={frames.length < 2 || isGenerating}
              sx={{
                bgcolor: '#0a66c2',
                '&:hover': { bgcolor: '#004182' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 2,
                py: 1,
              }}
            >
              {isGenerating ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
              {isGenerating ? 'Generating GIF...' : `Generate GIF (${frames.length} frames)`}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default GifMakerFloatingPanel;
