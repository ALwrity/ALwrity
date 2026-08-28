/**
 * Product Image Settings Preview Component
 * Shows a visual mockup preview of what the product image will look like based on selected settings.
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import Palette from '@mui/icons-material/Palette';
import LightMode from '@mui/icons-material/LightMode';
import StyleIcon from '@mui/icons-material/Style';

interface ProductImageSettingsPreviewProps {
  productName: string;
  environment: string;
  backgroundStyle: string;
  lighting: string;
  style: string;
  angle?: string;
  resolution?: string;
}

const ENVIRONMENT_ICONS: Record<string, string> = {
  studio: '🏛️',
  lifestyle: '🏠',
  outdoor: '🌲',
  minimalist: '✨',
  luxury: '💎',
};

const BACKGROUND_COLORS: Record<string, string> = {
  white: '#ffffff',
  transparent: 'transparent',
  lifestyle: '#f0f0f0',
  branded: '#7c3aed',
};

const LIGHTING_STYLES: Record<string, { gradient: string; opacity: number }> = {
  natural: { gradient: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))', opacity: 0.5 },
  studio: { gradient: 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2))', opacity: 0.7 },
  dramatic: { gradient: 'linear-gradient(135deg, rgba(0,0,0,0.3), rgba(255,255,255,0.2))', opacity: 0.6 },
  soft: { gradient: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))', opacity: 0.4 },
};

export const ProductImageSettingsPreview: React.FC<ProductImageSettingsPreviewProps> = ({
  productName,
  environment,
  backgroundStyle,
  lighting,
  style,
  angle,
  resolution = '1024x1024',
}) => {
  const backgroundColor = BACKGROUND_COLORS[backgroundStyle] || '#ffffff';
  const lightingStyle = LIGHTING_STYLES[lighting] || LIGHTING_STYLES.natural;
  const environmentIcon = ENVIRONMENT_ICONS[environment] || '📦';

  return (
    <Paper
      sx={{
        p: 3,
        background: 'rgba(16, 185, 129, 0.05)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: 2,
      }}
    >
      <Stack spacing={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <PhotoCamera sx={{ color: '#6ee7b7' }} />
          <Typography variant="h6" fontWeight={700}>
            Image Preview
          </Typography>
        </Box>

        {/* Mockup Preview */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: backgroundStyle === 'transparent' 
              ? 'repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 50% / 20px 20px'
              : backgroundColor,
            borderRadius: 2,
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Apply lighting effect
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: lightingStyle.gradient,
              opacity: lightingStyle.opacity,
              pointerEvents: 'none',
            },
          }}
        >
          {/* Product Placeholder */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              textAlign: 'center',
              p: 3,
            }}
          >
            <Typography variant="h2" sx={{ mb: 1 }}>
              {environmentIcon}
            </Typography>
            <Typography
              variant="body1"
              fontWeight={600}
              sx={{
                color: backgroundStyle === 'white' ? '#333' : '#fff',
                textShadow: backgroundStyle === 'white' 
                  ? 'none' 
                  : '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {productName || 'Your Product'}
            </Typography>
            {angle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Angle: {angle}
              </Typography>
            )}
          </Box>

          {/* Style Overlay Indicator */}
          {style === 'luxury' && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(0,0,0,0.6)',
                color: '#ffd700',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              💎 Luxury
            </Box>
          )}
        </Box>

        {/* Settings Summary */}
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Preview Settings
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              icon={<span>{environmentIcon}</span>}
              label={`${environment.charAt(0).toUpperCase() + environment.slice(1)}`}
              size="small"
              sx={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
            />
            <Chip
              icon={<Palette sx={{ fontSize: 16 }} />}
              label={`${backgroundStyle.charAt(0).toUpperCase() + backgroundStyle.slice(1)} Background`}
              size="small"
              sx={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
            />
            <Chip
              icon={<LightMode sx={{ fontSize: 16 }} />}
              label={`${lighting.charAt(0).toUpperCase() + lighting.slice(1)} Lighting`}
              size="small"
              sx={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
            />
            <Chip
              icon={<StyleIcon sx={{ fontSize: 16 }} />}
              label={`${style.charAt(0).toUpperCase() + style.slice(1)} Style`}
              size="small"
              sx={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
            />
            {resolution && (
              <Chip
                label={resolution}
                size="small"
                sx={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
              />
            )}
          </Box>
        </Stack>

        {/* Preview Note */}
        <Box
          sx={{
            p: 1.5,
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 1,
            border: '1px dashed rgba(16, 185, 129, 0.3)',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            💡 This is a preview mockup. The actual generated image will match your product description and brand style.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};
