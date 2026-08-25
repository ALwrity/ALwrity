/**
 * Asset Generation Cost Card Component
 * 
 * Displays cost estimate for generating images and audio for scenes.
 * Optimized for Step 3 (Generate Assets).
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import MoneyIcon from '@mui/icons-material/MonetizationOn';
import ImageIcon from '@mui/icons-material/Image';
import AudioIcon from '@mui/icons-material/VolumeUp';
import InfoIcon from '@mui/icons-material/Info';
import { Scene } from '../../../services/youtubeApi';

interface AssetGenerationCostCardProps {
  scenes: Scene[];
}

export const AssetGenerationCostCard: React.FC<AssetGenerationCostCardProps> = React.memo(({
  scenes,
}) => {
  const enabledScenes = scenes.filter(s => s.enabled !== false);
  const numScenes = enabledScenes.length;

  // Cost per asset (realistic estimates)
  const costPerImage = 0.10; // Ideogram V3 Turbo default
  const costPerAudio = 0.05; // Minimax TTS

  // Calculate what's needed
  const scenesNeedingImages = enabledScenes.filter(s => !s.imageUrl).length;
  const scenesNeedingAudio = enabledScenes.filter(s => !s.audioUrl).length;

  // Calculate costs
  const imageCost = scenesNeedingImages * costPerImage;
  const audioCost = scenesNeedingAudio * costPerAudio;
  const totalCost = imageCost + audioCost;

  if (numScenes === 0) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        No enabled scenes to generate assets for.
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        mt: 3,
        p: 3,
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        borderRadius: 3,
        border: '2px solid #667eea',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <MoneyIcon sx={{ color: '#667eea', fontSize: 28 }} />
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              color: '#1e293b',
              letterSpacing: '-0.01em',
            }}
          >
            💰 Asset Generation Cost
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#64748b',
              fontSize: '0.75rem',
            }}
          >
            Cost to generate images and audio for your scenes
          </Typography>
        </Box>
      </Box>

      {/* Total Cost Display */}
      <Box 
        sx={{ 
          mb: 3, 
          p: 2.5,
          bgcolor: 'white',
          borderRadius: 2,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            fontSize: '2.5rem',
            color: totalCost === 0 ? '#10b981' : '#667eea',
            lineHeight: 1.2,
            mb: 0.5,
          }}
        >
          {totalCost === 0 ? 'FREE!' : `$${totalCost.toFixed(2)}`}
        </Typography>
        {totalCost === 0 ? (
          <Typography
            variant="body2"
            sx={{
              color: '#10b981',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            ✅ All scenes already have their assets!
          </Typography>
        ) : (
          <Typography
            variant="body2"
            sx={{
              color: '#64748b',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            To generate missing assets for {scenesNeedingImages + scenesNeedingAudio} item(s)
          </Typography>
        )}
      </Box>

      {/* What's Included Section */}
      <Box
        sx={{
          p: 2.5,
          bgcolor: 'white',
          borderRadius: 2,
          mb: 2.5,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: '#1e293b',
            fontWeight: 700,
            mb: 2,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <InfoIcon sx={{ fontSize: 18, color: '#667eea' }} />
          What You'll Generate
        </Typography>

        <Stack spacing={2}>
          {/* Scene Images */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <ImageIcon sx={{ fontSize: 20, color: '#10b981' }} />
              <Typography
                variant="body2"
                sx={{
                  color: '#1e293b',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Scene Images
              </Typography>
              <Chip 
                label={scenesNeedingImages === 0 ? 'All Ready' : `${scenesNeedingImages} needed`}
                size="small"
                sx={{ 
                  ml: 'auto',
                  bgcolor: scenesNeedingImages === 0 ? '#10b981' : '#667eea',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
              {scenesNeedingImages > 0 && (
                <Chip 
                  label={`$${imageCost.toFixed(2)}`}
                  size="small"
                  sx={{ 
                    bgcolor: '#667eea',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: '#64748b',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                ml: 3.5,
              }}
            >
              {scenesNeedingImages === 0 ? (
                <>All {numScenes} scenes already have custom images</>
              ) : (
                <>Creating <strong>{scenesNeedingImages} AI-generated images</strong> tailored to your scene content</>
              )}
            </Typography>
            {scenesNeedingImages > 0 && (
              <Typography
                variant="caption"
                sx={{
                  color: '#94a3b8',
                  fontSize: '0.7rem',
                  display: 'block',
                  ml: 3.5,
                  mt: 0.5,
                }}
              >
                Rate: ${costPerImage.toFixed(2)}/image • High-quality visuals using Ideogram V3 Turbo
              </Typography>
            )}
          </Box>

          {/* Scene Audio */}
          {scenesNeedingAudio > 0 || scenesNeedingImages > 0 ? (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <AudioIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#1e293b',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  >
                    Audio Narration
                  </Typography>
                  <Chip 
                    label={scenesNeedingAudio === 0 ? 'All Ready' : `${scenesNeedingAudio} needed`}
                    size="small"
                    sx={{ 
                      ml: 'auto',
                      bgcolor: scenesNeedingAudio === 0 ? '#10b981' : '#f59e0b',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
                  {scenesNeedingAudio > 0 && (
                    <Chip 
                      label={`$${audioCost.toFixed(2)}`}
                      size="small"
                      sx={{ 
                        bgcolor: '#f59e0b',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#64748b',
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                    ml: 3.5,
                  }}
                >
                  {scenesNeedingAudio === 0 ? (
                    <>All {numScenes} scenes already have professional voice narration</>
                  ) : (
                    <>Generating <strong>{scenesNeedingAudio} AI voice narrations</strong> from your scene scripts</>
                  )}
                </Typography>
                {scenesNeedingAudio > 0 && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#94a3b8',
                      fontSize: '0.7rem',
                      display: 'block',
                      ml: 3.5,
                      mt: 0.5,
                    }}
                  >
                    Rate: ${costPerAudio.toFixed(2)}/audio • Natural-sounding voice using Minimax TTS
                  </Typography>
                )}
              </Box>
            </>
          ) : null}
        </Stack>

        {/* Summary Box */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: '#f1f5f9',
            borderRadius: 1.5,
            border: '1px solid #cbd5e1',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#475569',
              fontSize: '0.75rem',
              lineHeight: 1.6,
              display: 'block',
            }}
          >
            💡 <strong>Smart Generation:</strong> Generate only what you need! If you already have an image or audio for a scene, 
            we won't charge you to regenerate it unless you explicitly click the regenerate button.
          </Typography>
        </Box>
      </Box>

      {/* Help Section */}
      <Alert 
        severity="info" 
        icon={<InfoIcon />}
        sx={{ 
          bgcolor: '#eff6ff',
          border: '1px solid #bfdbfe',
          '& .MuiAlert-icon': {
            color: '#3b82f6',
          },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.5 }}>
          How does this work?
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.5, display: 'block' }}>
          Click "Generate Image" and "Generate Audio" buttons on each scene card. Images use AI to create custom 
          visuals matching your content, and audio uses text-to-speech to narrate your script naturally. 
          You only pay for what you generate!
        </Typography>
      </Alert>
    </Box>
  );
});

AssetGenerationCostCard.displayName = 'AssetGenerationCostCard';

