/**
 * Cost Estimate Card Component
 * 
 * Displays user-friendly cost estimate with clear breakdown and explanations.
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import MoneyIcon from '@mui/icons-material/MonetizationOn';
import VideoIcon from '@mui/icons-material/VideoLibrary';
import ImageIcon from '@mui/icons-material/Image';
import InfoIcon from '@mui/icons-material/Info';
import { CostEstimate, Scene } from '../../../services/youtubeApi';

interface CostEstimateCardProps {
  costEstimate: CostEstimate | null;
  loadingCostEstimate: boolean;
  scenes?: Scene[];
}

export const CostEstimateCard: React.FC<CostEstimateCardProps> = React.memo(({
  costEstimate,
  loadingCostEstimate,
  scenes = [],
}) => {
  // Calculate total image cost if available
  const totalImageCost = useMemo(() => {
    if (!costEstimate) return 0;
    return costEstimate.total_image_cost || 
           (costEstimate.image_cost_per_scene ? costEstimate.num_scenes * costEstimate.image_cost_per_scene : 0);
  }, [costEstimate]);

  // Calculate video rendering cost
  const videoRenderCost = useMemo(() => {
    if (!costEstimate) return 0;
    return costEstimate.total_cost - totalImageCost;
  }, [costEstimate, totalImageCost]);

  if (loadingCostEstimate) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Calculating your video cost...
        </Typography>
      </Box>
    );
  }

  if (!costEstimate) {
    // Check which scenes are missing assets
    const enabledScenes = scenes.filter(s => s.enabled !== false);
    const scenesMissingImage = enabledScenes.filter(s => !s.imageUrl);
    const scenesMissingAudio = enabledScenes.filter(s => !s.audioUrl);
    const scenesMissingBoth = enabledScenes.filter(s => !s.imageUrl && !s.audioUrl);
    
    let errorMessage = 'Please ensure all enabled scenes have images and audio.';
    if (scenesMissingBoth.length > 0 || scenesMissingImage.length > 0 || scenesMissingAudio.length > 0) {
      const missingDetails: string[] = [];
      if (scenesMissingImage.length > 0) {
        missingDetails.push(`${scenesMissingImage.length} scene${scenesMissingImage.length !== 1 ? 's' : ''} missing image${scenesMissingImage.length !== 1 ? 's' : ''}`);
      }
      if (scenesMissingAudio.length > 0) {
        missingDetails.push(`${scenesMissingAudio.length} scene${scenesMissingAudio.length !== 1 ? 's' : ''} missing audio`);
      }
      if (missingDetails.length > 0) {
        errorMessage = `Unable to calculate cost: ${missingDetails.join(', ')}. Go back to "Generate Assets" step to create missing assets.`;
      }
    }
    
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Unable to calculate cost estimate
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          {errorMessage}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        mt: 3,
        p: 3,
        bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            💰 Total Cost Estimate
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#64748b',
              fontSize: '0.75rem',
            }}
          >
            What you'll pay to create this video
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
            color: '#667eea',
            lineHeight: 1.2,
            mb: 0.5,
          }}
        >
          ${costEstimate.total_cost.toFixed(2)}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#64748b',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Estimated range: ${costEstimate.estimated_cost_range.min.toFixed(2)} - ${costEstimate.estimated_cost_range.max.toFixed(2)}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: '#94a3b8',
            fontSize: '0.75rem',
            display: 'block',
            mt: 0.5,
          }}
        >
          Final cost may vary by ±10% based on actual processing
        </Typography>
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
          What's Included in This Price
        </Typography>

        <Stack spacing={2}>
          {/* Video Rendering */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <VideoIcon sx={{ fontSize: 20, color: '#667eea' }} />
              <Typography
                variant="body2"
                sx={{
                  color: '#1e293b',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                AI Video Generation
              </Typography>
              <Chip 
                label={`$${videoRenderCost.toFixed(2)}`}
                size="small"
                sx={{ 
                  ml: 'auto',
                  bgcolor: '#667eea',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
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
              Creating <strong>{costEstimate.num_scenes} video scenes</strong> ({Math.round(costEstimate.total_duration_seconds)} seconds total) at <strong>{costEstimate.resolution}</strong> quality
            </Typography>
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
              Rate: ${costEstimate.price_per_second.toFixed(2)}/second • Using advanced AI to transform your narration into engaging video scenes
            </Typography>
          </Box>

          {/* Image Generation (if applicable) */}
          {totalImageCost > 0 && (
            <>
              <Divider sx={{ my: 0.5 }} />
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
                    label={`$${totalImageCost.toFixed(2)}`}
                    size="small"
                    sx={{ 
                      ml: 'auto',
                      bgcolor: '#10b981',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
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
                  Generating <strong>{costEstimate.num_scenes} custom images</strong> for your video scenes
                  {costEstimate.image_model && ` using ${costEstimate.image_model}`}
                </Typography>
                {costEstimate.image_cost_per_scene && (
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
                    Rate: ${costEstimate.image_cost_per_scene.toFixed(2)}/image • High-quality AI-generated visuals tailored to your content
                  </Typography>
                )}
              </Box>
            </>
          )}
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
            💡 <strong>Good to know:</strong> You only pay for the AI processing to create your video. 
            There are no hidden fees, subscription requirements, or storage charges. 
            Once created, your video is yours to download and use forever!
          </Typography>
        </Box>
      </Box>

      {/* Per Scene Breakdown (Optional, collapsible) */}
      {costEstimate.scene_costs.length > 0 && (
        <Box
          sx={{
            p: 2.5,
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: '0.875rem',
              color: '#1e293b',
              mb: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            📊 Cost Per Scene
            <Typography
              component="span"
              variant="caption"
              sx={{
                ml: 'auto',
                color: '#64748b',
                fontWeight: 500,
              }}
            >
              {costEstimate.scene_costs.length} scenes
            </Typography>
          </Typography>
          
          <Stack spacing={1}>
            {costEstimate.scene_costs.slice(0, 5).map((sceneCost, idx) => (
              <Box
                key={sceneCost.scene_number}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                  borderRadius: 1,
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: '#f1f5f9',
                    borderColor: '#cbd5e1',
                  },
                }}
              >
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#1e293b',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    Scene {sceneCost.scene_number}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#64748b',
                      fontSize: '0.7rem',
                    }}
                  >
                    {sceneCost.actual_duration}s video
                    {sceneCost.duration_estimate !== sceneCost.actual_duration && 
                      ` (optimized from ${sceneCost.duration_estimate}s)`}
                  </Typography>
                </Box>
                <Chip
                  label={`$${sceneCost.cost.toFixed(2)}`}
                  size="small"
                  sx={{
                    bgcolor: '#667eea',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              </Box>
            ))}
            
            {costEstimate.scene_costs.length > 5 && (
              <Box
                sx={{
                  py: 1,
                  textAlign: 'center',
                  bgcolor: '#f8fafc',
                  borderRadius: 1,
                  border: '1px dashed #cbd5e1',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                  }}
                >
                  + {costEstimate.scene_costs.length - 5} more scenes
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#94a3b8',
                    fontSize: '0.7rem',
                  }}
                >
                  (scroll down after rendering to see all scenes)
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      )}

      {/* Help Section */}
      <Alert 
        severity="info" 
        icon={<InfoIcon />}
        sx={{ 
          mt: 2.5,
          bgcolor: '#eff6ff',
          border: '1px solid #bfdbfe',
          '& .MuiAlert-icon': {
            color: '#3b82f6',
          },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.5 }}>
          Why does video creation cost money?
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.5, display: 'block' }}>
          Creating videos with AI requires powerful computing resources. Each second of video is generated by 
          advanced AI models that analyze your script, create visuals, and synchronize everything perfectly. 
          The cost covers the actual AI processing time needed to bring your content to life.
        </Typography>
      </Alert>
    </Box>
  );
});

CostEstimateCard.displayName = 'CostEstimateCard';

