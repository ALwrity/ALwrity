import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  IconButton,
  Typography,
  Button,
  Slider,
  Box,
  Chip,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import VideocamIcon from '@mui/icons-material/Videocam';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SendIcon from '@mui/icons-material/Send';
import type { Frame, FrameMetadata, GifResult, GifHandoffSession } from './types';
import { generateGif, saveSession } from './gifMakerApi';

interface GifMakerFloatingPanelProps {
  open: boolean;
  onClose: () => void;
  apiBaseUrl?: string;
}

const accent = '#16a34a';

export const GifMakerFloatingPanel: React.FC<GifMakerFloatingPanelProps> = ({
  open,
  onClose,
  apiBaseUrl = '',
}) => {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [duration, setDuration] = useState(1500);
  const [maxWidth, setMaxWidth] = useState(800);
  const [minimized, setMinimized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isHidingForCapture, setIsHidingForCapture] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GifResult | null>(null);
  const [topic, setTopic] = useState('');
  const [sessionMetadata, setSessionMetadata] = useState<{
    pageTitle: string;
    pageUrl: string;
    createdAt: string;
  }>({ pageTitle: '', pageUrl: '', createdAt: '' });
  const [targetApp, setTargetApp] = useState('');
  const [isHandingOff, setIsHandingOff] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const navigate = useNavigate();

  const toBlobPromise = useCallback((canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> => {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }, []);

  const captureFrameMetadata = useCallback((sequence: number): FrameMetadata => {
    const selection = window.getSelection()?.toString()?.trim();
    return {
      sequence,
      capturedAt: new Date().toISOString(),
      pageTitle: document.title || '',
      pageUrl: window.location.href || '',
      pageHeading: document.querySelector('h1')?.textContent?.trim() || '',
      pageDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      ...(selection ? { selectedText: selection } : {}),
    };
  }, []);

  const captureFrame = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Screen capture is not supported in this browser');
      return;
    }

    // Capture metadata before the panel is hidden so DOM context is accurate.
    const nextSequence = frames.length + 1;
    const metadata = captureFrameMetadata(nextSequence);

    setIsCapturing(true);
    setIsHidingForCapture(true);

    if (!topic) {
      setTopic(metadata.pageTitle || metadata.pageHeading || '');
    }
    if (!sessionMetadata.createdAt) {
      setSessionMetadata({
        pageTitle: metadata.pageTitle,
        pageUrl: metadata.pageUrl,
        createdAt: metadata.capturedAt,
      });
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));

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

      const maxDim = 1280;
      let cw = video.videoWidth;
      let ch = video.videoHeight;
      if (cw > maxDim || ch > maxDim) {
        const scale = cw >= ch ? maxDim / cw : maxDim / ch;
        cw = Math.round(cw * scale);
        ch = Math.round(ch * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d')!.drawImage(video, 0, 0, cw, ch);

      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = await toBlobPromise(canvas, 'image/png');
      if (blob) {
        const file = new File([blob], `frame-${Date.now()}.png`, { type: 'image/png' });
        setFrames((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            file,
            thumbnail: URL.createObjectURL(blob),
            width: cw,
            height: ch,
            metadata,
          },
        ]);
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'NotAllowedError') return;
      console.error('Screen capture failed:', err);
    } finally {
      setIsHidingForCapture(false);
      setIsCapturing(false);
    }
  }, [toBlobPromise, captureFrameMetadata, frames.length, sessionMetadata.createdAt, topic]);

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

  const handleHandoff = useCallback(async () => {
    if (!targetApp || frames.length === 0) return;
    setIsHandingOff(true);

    // Generate GIF first if not already done
    if (!result) {
      if (frames.length < 2) {
        alert('Need at least 2 frames to create a GIF');
        setIsHandingOff(false);
        return;
      }
      try {
        const gifResult = await generateGif({
          frames: frames.map((f) => f.file),
          settings: { duration, endFrameDelay: 3000, maxWidth, loop: true, sharedPalette: true, optimizeLevel: 0 },
          apiBaseUrl,
        });
        setResult(gifResult);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Generation failed');
        setIsHandingOff(false);
        return;
      }
    }

    // Convert GIF blob URL to a Blob for upload
    let gifBlob: Blob | null = null;
    try {
      const gifRes = await fetch(result!.url);
      gifBlob = await gifRes.blob();
    } catch {
      // GIF upload is optional — proceed without it
    }

    const sessionMeta = {
      topic: topic || sessionMetadata.pageTitle || document.title,
      pageTitle: sessionMetadata.pageTitle || document.title,
      pageUrl: sessionMetadata.pageUrl || window.location.href,
      createdAt: sessionMetadata.createdAt || new Date().toISOString(),
      frames: frames.map((f) => ({ metadata: f.metadata })),
    };

    let handoffSession: GifHandoffSession;

    try {
      const saveResult = await saveSession({
        frames: frames.map((f) => f.file),
        gif: gifBlob,
        metadata: sessionMeta,
        apiBaseUrl,
      });

      handoffSession = {
        ...sessionMeta,
        sessionTag: saveResult.session_tag,
        frames: saveResult.frames.map((fa, i) => ({
          metadata: frames[i].metadata,
          assetId: fa.asset_id,
          fileUrl: fa.file_url,
        })),
        gif: saveResult.gif
          ? { assetId: saveResult.gif.asset_id, fileUrl: saveResult.gif.file_url }
          : undefined,
      };
    } catch {
      // Save failed (backend may be offline) — navigate with metadata only
      console.warn('[GIF Maker] Save session failed, handing off with metadata only');
      handoffSession = {
        ...sessionMeta,
        sessionTag: '',
        frames: frames.map((f) => ({
          metadata: f.metadata,
          assetId: null,
          fileUrl: '',
        })),
      };
    }

    if (targetApp === 'blog') {
      navigate('/blog-writer', { state: { gifHandoff: handoffSession } });
    }

    setIsHandingOff(false);
    onClose();
  }, [targetApp, frames, result, duration, maxWidth, apiBaseUrl, topic, sessionMetadata, navigate, onClose]);

  const scrollAreaSx = {
    overflowY: 'auto',
    flexShrink: 1,
    minHeight: 0,
    '&::-webkit-scrollbar': { width: 4 },
    '&::-webkit-scrollbar-thumb': { bgcolor: alpha('#000', 0.15), borderRadius: 2 },
  };

  const handleMinimize = useCallback(() => {
    setMinimized(true);
  }, []);

  const handleExpand = useCallback(() => {
    setMinimized(false);
  }, []);

  // Always render via portal — when closed the Box is display:none but
  // component stays mounted, preserving frames/settings across close/reopen.
  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 2147483647,
        display: !open || isHidingForCapture ? 'none' : undefined,
        pointerEvents: 'auto',
      }}
    >
      {minimized ? (
        /* Minimized badge — click to expand */
        <Box
          onClick={handleExpand}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleExpand(); }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: accent,
            color: '#fff',
            px: 1.5,
            py: 0.75,
            borderRadius: 3,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            '&:hover': { bgcolor: '#15803d' },
            transition: 'background 0.15s',
            userSelect: 'none',
          }}
        >
          <VideocamIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1 }}>
            GIF {frames.length > 0 && `(${frames.length})`}
          </Typography>
        </Box>
      ) : (
        /* Full panel */
        <Paper
          elevation={24}
          sx={{
            borderRadius: 2.5,
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh',
            width: 380,
            border: '1px solid',
            borderColor: alpha('#000', 0.08),
            bgcolor: '#ffffff',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: '#fff', borderBottom: '1px solid', borderColor: alpha('#000', 0.06) }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
              <VideocamIcon sx={{ fontSize: 18, color: accent }} />
              GIF Maker
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <IconButton size="small" onClick={handleMinimize} title="Minimize" sx={{ color: '#94a3b8', '&:hover': { bgcolor: alpha('#000', 0.04) } }}>
                <RemoveIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={onClose} title="Close" sx={{ color: '#94a3b8', '&:hover': { bgcolor: alpha('#000', 0.04) } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
                    </Box>
                    {!targetApp && (
                      <Typography sx={{ fontSize: 10.5, color: '#94a3b8', mt: 0.5, lineHeight: 1.3 }}>
                        Select a target app, then click Save &amp; Handoff
                      </Typography>
                    )}
                  </Box>

          {/* Info banner */}
          <Box sx={{ px: 2, py: 1, bgcolor: alpha(accent, 0.06), borderBottom: '1px solid', borderColor: alpha(accent, 0.12) }}>
            <Typography sx={{ fontSize: 11.5, color: alpha('#000', 0.6), display: 'flex', alignItems: 'center', gap: 0.75, lineHeight: 1.4 }}>
              <InfoOutlinedIcon sx={{ fontSize: 14, color: accent, flexShrink: 0 }} />
              This panel auto-hides during capture — it will never appear in your screenshots
            </Typography>
          </Box>

          {/* Session topic — editable, seeded from page title */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: alpha('#000', 0.06) }}>
            <TextField
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic or page title"
              label="Blog topic"
              size="small"
              fullWidth
              variant="outlined"
              inputProps={{ style: { fontSize: 13, color: '#1e293b' } }}
              InputLabelProps={{ style: { fontSize: 13, color: '#475569' } }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f8fafc' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#000', 0.15) },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#000', 0.25) },
              }}
            />
            <Typography sx={{ fontSize: 10, color: '#94a3b8', mt: 0.5, lineHeight: 1.3 }}>
              Used as the blog keyword prompt. Auto-filled from the page title.
            </Typography>
          </Box>

          {frames.length === 0 && !result ? (
            <>
              {/* Capture button — prominent when no frames yet */}
              <Box sx={{ px: 2, py: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={captureFrame}
                  disabled={isCapturing}
                  startIcon={isCapturing ? <CircularProgress size={16} color="inherit" /> : <VideocamIcon />}
                  sx={{
                    bgcolor: accent,
                    '&:hover': { bgcolor: '#15803d' },
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 14,
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                  }}
                >
                  {isCapturing ? 'Select tab to capture...' : 'Capture First Frame'}
                </Button>
                <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>
                  Then edit settings before generating
                </Typography>
              </Box>
            </>
          ) : (
            <>
              {/* Scrollable middle area */}
              <Box sx={scrollAreaSx}>
                {/* Capture button — compact when frames exist */}
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: alpha('#000', 0.06) }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={captureFrame}
                    disabled={isCapturing}
                    startIcon={isCapturing ? <CircularProgress size={16} color="inherit" /> : <VideocamIcon />}
                    sx={{
                      bgcolor: accent,
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
                  <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: alpha('#000', 0.06) }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Frames ({frames.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {frames.map((frame, i) => (
                        <Box
                          key={frame.id}
                          sx={{
                            position: 'relative',
                            width: 80,
                            height: 60,
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: alpha('#000', 0.08),
                            flexShrink: 0,
                            bgcolor: '#f8fafc',
                          }}
                        >
                          <img
                            src={frame.thumbnail}
                            alt={`Frame ${i + 1}`}
                            title={`Frame ${i + 1}\n${frame.metadata.pageTitle}\n${frame.metadata.pageUrl}\nHeading: ${frame.metadata.pageHeading || '—'}\n${frame.metadata.selectedText ? `Selected: "${frame.metadata.selectedText}"` : ''}`}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />

                          <IconButton
                            size="small"
                            onClick={() => removeFrame(frame.id)}
                            sx={{
                              position: 'absolute', top: 2, right: 2,
                              bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                              width: 18, height: 18,
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 11 }} />
                          </IconButton>
                          <Chip
                            label={String(i + 1)}
                            size="small"
                            sx={{
                              position: 'absolute', bottom: 2, left: 2,
                              height: 16, minWidth: 16, fontSize: 10,
                              bgcolor: 'rgba(0,0,0,0.6)', color: '#fff',
                              fontWeight: 700,
                            }}
                          />
                          <Typography
                            sx={{
                              position: 'absolute', bottom: 2, right: 2,
                              fontSize: 9, color: alpha('#fff', 0.9),
                              bgcolor: 'rgba(0,0,0,0.45)', px: 0.5, borderRadius: 0.5,
                              lineHeight: 1.4,
                            }}
                          >
                            {frame.width}×{frame.height}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Settings */}
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: alpha('#000', 0.06) }}>
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
                      sx={{ color: accent, '& .MuiSlider-thumb': { width: 14, height: 14 } }}
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
                      sx={{ color: accent, '& .MuiSlider-thumb': { width: 14, height: 14 } }}
                    />
                  </Box>
                </Box>
              </Box>

              {/* Sticky bottom — always reachable */}
              <Box sx={{ flexShrink: 0, px: 2, py: 1.5, bgcolor: '#fff', borderTop: '1px solid', borderColor: alpha('#000', 0.06) }}>
                {result ? (
                  <Box>
                    <Box sx={{ mb: 1, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: alpha('#000', 0.08) }}>
                      <img src={result.url} alt="GIF preview" style={{ width: '100%', display: 'block' }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
                      {result.width && <Chip label={`${result.width}×${result.height}`} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />}
                      <Chip label={`${result.numFrames} frames`} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />
                      <Chip label={`${(result.sizeBytes / 1024).toFixed(1)} KB`} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleDownload}
                        startIcon={<DownloadIcon />}
                        sx={{ bgcolor: accent, '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 600, fontSize: 13, borderRadius: 2, py: 1 }}
                      >
                        Download GIF
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => { setResult(null); setFrames([]); setTopic(''); setSessionMetadata({ pageTitle: '', pageUrl: '', createdAt: '' }); setTargetApp(''); }}
                        sx={{ textTransform: 'none', fontSize: 13, borderRadius: 2, color: '#64748b', borderColor: alpha('#000', 0.15), flexShrink: 0 }}
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

                {/* Handoff row — visible when frames exist */}
                {frames.length > 0 && (
                  <Box sx={{ pt: 1, mt: 1, borderTop: '1px solid', borderColor: alpha('#000', 0.06) }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75 }}>
                      Handoff to App
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel sx={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Send to...</InputLabel>
                        <Select
                          value={targetApp}
                          label="Send to..."
                          onChange={(e) => { setTargetApp(e.target.value); }}
                          sx={{
                            fontSize: 13,
                            borderRadius: 2,
                            bgcolor: '#f8fafc',
                            color: '#1e293b',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#000', 0.15) },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#000', 0.25) },
                          }}
                          MenuProps={{
                            disablePortal: true,
                            slotProps: {
                              paper: {
                                sx: {
                                  zIndex: 2147483647,
                                  mt: 0.5,
                                  borderRadius: 2,
                                  border: '1px solid',
                                  borderColor: alpha('#000', 0.08),
                                  bgcolor: '#ffffff',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                },
                              },
                            },
                          }}
                        >
                          <MenuItem
                            value="blog"
                            sx={{ fontSize: 13, color: '#1e293b', bgcolor: '#ffffff', '&:hover': { bgcolor: '#f1f5f9' }, '&.Mui-selected': { bgcolor: '#f0fdf4', '&:hover': { bgcolor: '#dcfce7' } } }}
                          >
                            Blog Writer
                          </MenuItem>
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        onClick={handleHandoff}
                        disabled={!targetApp || isHandingOff}
                        endIcon={isHandingOff ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                        sx={{
                          bgcolor: accent,
                          '&:hover': { bgcolor: '#15803d' },
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: 13,
                          borderRadius: 2,
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {isHandingOff ? 'Saving...' : 'Save & Handoff'}
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Paper>
      )}
    </Box>,
    document.body
  );
};

export default GifMakerFloatingPanel;
