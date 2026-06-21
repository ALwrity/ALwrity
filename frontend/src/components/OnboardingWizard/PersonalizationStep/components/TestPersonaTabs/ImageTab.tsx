import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Stack, Button, Alert, Chip, Grid, Card, CardActionArea, CardContent,
  CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import ArticleIcon from '@mui/icons-material/Article';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import TwitterIcon from '@mui/icons-material/Twitter';
import DownloadIcon from '@mui/icons-material/Download';
import LockIcon from '@mui/icons-material/Lock';
import { testDriveApi, TestImageResponse, TestImagePlatform } from '../../../../../api/onboarding/testDriveApi';
import type { TestDriveImageResult } from './types';

const SESSION_KEY = 'test_drive_image_results';
const COUNTER_KEY = 'test_drive_image_counter';
const SESSION_LIMIT = 3;

interface PlatformDef {
  id: TestImagePlatform;
  label: string;
  icon: React.ReactElement;
  color: string;
  aspect: string;
  hint: string;
}

const PLATFORMS: PlatformDef[] = [
  { id: 'blog',      label: 'Blog',      icon: <ArticleIcon />,    color: '#FF6B35', aspect: '16:9', hint: 'Header image with space for headline' },
  { id: 'podcast',   label: 'Podcast',   icon: <PodcastsIcon />,   color: '#7C3AED', aspect: '1:1',  hint: 'Square cover art, bold typography' },
  { id: 'youtube',   label: 'YouTube',   icon: <VideoLibraryIcon/>, color: '#EF4444', aspect: '16:9', hint: 'Cinematic thumbnail style' },
  { id: 'instagram', label: 'Instagram', icon: <PhotoCameraIcon />, color: '#E4405F', aspect: '1:1',  hint: 'Lifestyle aesthetic, modern' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: <LinkedInIcon />,   color: '#0077B5', aspect: '16:9', hint: 'Professional, clean, wide' },
  { id: 'twitter',   label: 'Twitter',   icon: <TwitterIcon />,    color: '#1DA1F2', aspect: '16:9', hint: 'Minimal, attention-grabbing' },
];

interface ImageTabProps {
  hasBrandAvatar: boolean;
}

export const ImageTab: React.FC<ImageTabProps> = ({ hasBrandAvatar }) => {
  const [loading, setLoading] = useState<TestImagePlatform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TestDriveImageResult[]>([]);
  const [usedCount, setUsedCount] = useState(0);

  // Load session results on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed: TestDriveImageResult[] = JSON.parse(stored);
        if (Array.isArray(parsed)) setResults(parsed);
      }
      const counter = sessionStorage.getItem(COUNTER_KEY);
      if (counter) setUsedCount(parseInt(counter, 10) || 0);
    } catch (e) {
      console.warn('Failed to load test drive image results:', e);
    }
  }, []);

  const persistResults = (next: TestDriveImageResult[]) => {
    setResults(next);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to persist test drive image results:', e);
    }
  };

  const bumpCounter = () => {
    setUsedCount((c) => {
      const next = c + 1;
      try {
        sessionStorage.setItem(COUNTER_KEY, String(next));
      } catch (e) { /* ignore */ }
      return next;
    });
  };

  const atLimit = usedCount >= SESSION_LIMIT;

  const handleGenerate = async (platform: TestImagePlatform) => {
    if (atLimit || loading) return;
    setLoading(platform);
    setError(null);
    try {
      const resp: TestImageResponse = await testDriveApi.testImage({ platform });
      if (resp.success && resp.image_base64) {
        const imageUrl = `data:${resp.format || 'image/png'};base64,${resp.image_base64}`;
        const result: TestDriveImageResult = {
          platform,
          imageUrl,
          filename: `avatar_${platform}_${Date.now()}.png`,
          prompt: resp.prompt || '',
          createdAt: Date.now(),
        };
        persistResults([result, ...results]);
        bumpCounter();
      } else {
        setError(resp.message || 'Image generation failed.');
      }
    } catch (e: any) {
      setError(e?.message || 'Image generation failed.');
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = (result: TestDriveImageResult) => {
    const link = document.createElement('a');
    link.href = result.imageUrl;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getResultForPlatform = (platform: TestImagePlatform) =>
    results.find((r) => r.platform === platform);

  if (!hasBrandAvatar) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #EC4899 0%, #f9a8d4 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            boxShadow: '0 8px 20px -5px rgba(236, 72, 153, 0.4)',
          }}
        >
          <ImageIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e1b4b', mb: 1 }}>
          Brand Visual not ready yet
        </Typography>
        <Typography variant="body2" sx={{ color: '#6b7280', maxWidth: 360, mx: 'auto' }}>
          Generate a brand visual on the <strong>Brand Visual</strong> tab, then come back here
          to test it across platforms.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e1b4b' }}>
            Pick a platform — 1 click = 1 variation
          </Typography>
          <Chip
            size="small"
            icon={atLimit ? <LockIcon sx={{ fontSize: 12 }} /> : undefined}
            label={`${usedCount} / ${SESSION_LIMIT} this session`}
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 700,
              bgcolor: atLimit ? '#fef3c7' : '#ecfeff',
              color: atLimit ? '#92400e' : '#155e75',
            }}
          />
        </Stack>
        <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 1.5 }}>
          Each click generates one variation tuned to that platform's best practices.
          Your variations are saved automatically.
        </Typography>
        <Grid container spacing={1.5}>
          {PLATFORMS.map((p) => {
            const result = getResultForPlatform(p.id);
            const isLoading = loading === p.id;
            const disabled = atLimit || isLoading || (!!loading && !isLoading);
            return (
              <Grid item xs={6} sm={4} key={p.id}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: result
                      ? `2px solid ${p.color}`
                      : '1px solid #e2e8f0',
                    background: result
                      ? `linear-gradient(135deg, ${p.color}08 0%, ${p.color}03 100%)`
                      : '#ffffff',
                    opacity: disabled && !isLoading ? 0.55 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CardActionArea
                    onClick={() => handleGenerate(p.id)}
                    disabled={disabled}
                    sx={{ p: 1.5, minHeight: 92 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          background: `${p.color}15`,
                          color: p.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {p.icon}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                            {p.label}
                          </Typography>
                          {isLoading && <CircularProgress size={14} sx={{ color: p.color }} />}
                          {result && !isLoading && (
                            <Tooltip title="Variation generated" arrow>
                              <Box
                                sx={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: '50%',
                                  background: p.color,
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                ✓
                              </Box>
                            </Tooltip>
                          )}
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.65rem' }}>
                          {p.aspect} · {result ? 'Done' : p.hint}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        {atLimit && (
          <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2, py: 0.5 }}>
            <Typography variant="caption">
              You've used all 3 variations for this session. Come back later or test in the
              Blog Writer to generate more.
            </Typography>
          </Alert>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {results.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
            Your variations
          </Typography>
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            {results.map((r) => {
              const def = PLATFORMS.find((p) => p.id === r.platform);
              if (!def) return null;
              return (
                <Grid item xs={12} sm={6} key={r.platform + r.createdAt}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        paddingTop: def.aspect === '1:1' ? '100%' : '56.25%',
                        background: `linear-gradient(135deg, ${def.color}10 0%, ${def.color}05 100%)`,
                      }}
                    >
                      <Box
                        component="img"
                        src={r.imageUrl}
                        alt={`${def.label} variation`}
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'rgba(255,255,255,0.95)',
                          borderRadius: 1.5,
                          px: 1,
                          py: 0.25,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: def.color,
                        }}
                      >
                        {def.label} · {def.aspect}
                      </Box>
                    </Box>
                    <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>
                        Generated just now
                      </Typography>
                      <Tooltip title="Download" arrow>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleDownload(r); }}
                          sx={{ color: def.color }}
                        >
                          <DownloadIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Stack>
  );
};

export default ImageTab;
