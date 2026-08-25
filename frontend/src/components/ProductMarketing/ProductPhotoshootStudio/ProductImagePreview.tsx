import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import Download from '@mui/icons-material/Download';
import Share from '@mui/icons-material/Share';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Refresh from '@mui/icons-material/Refresh';
import ImageIcon from '@mui/icons-material/Image';
import { motion } from 'framer-motion';

const MotionCard = motion.create(Card);

interface GeneratedProductImage {
  image_url?: string;
  asset_id?: number;
  product_name: string;
  provider?: string;
  model?: string;
  cost?: number;
  generation_time?: number;
  success: boolean;
  error?: string;
}

interface ProductImagePreviewProps {
  generatedImages: GeneratedProductImage[];
  isLoading: boolean;
  error: string | null;
  onDownload?: (image: GeneratedProductImage) => void;
  onRegenerate?: () => void;
  onSaveToLibrary?: (image: GeneratedProductImage) => void;
}

export const ProductImagePreview: React.FC<ProductImagePreviewProps> = ({
  generatedImages,
  isLoading,
  error,
  onDownload,
  onRegenerate,
  onSaveToLibrary,
}) => {
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary">
          Generating your product image...
        </Typography>
        <Typography variant="caption" color="text.secondary">
          This may take 30-60 seconds
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mb: 2 }}
        action={
          onRegenerate && (
            <Button color="inherit" size="small" onClick={onRegenerate}>
              Try Again
            </Button>
          )
        }
      >
        {error}
      </Alert>
    );
  }

  if (!generatedImages || generatedImages.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 2,
          textAlign: 'center',
          p: 4,
        }}
      >
        <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
        <Typography variant="h6" color="text.secondary">
          No images generated yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Fill in the product details and click "Generate Product Image" to create your first product photo
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight={600}>
          Generated Images ({generatedImages.length})
        </Typography>
        {onRegenerate && (
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRegenerate}
            size="small"
          >
            Regenerate
          </Button>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 3,
        }}
      >
        {generatedImages.map((image, index) => (
          <MotionCard
            key={image.asset_id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
            }}
          >
            {image.image_url ? (
              <Box
                component="img"
                src={image.image_url}
                alt={image.product_name}
                sx={{
                  width: '100%',
                  height: 300,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.2)',
                }}
              >
                <ImageIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
              </Box>
            )}

            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {image.product_name}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {image.provider && (
                    <Chip label={image.provider} size="small" variant="outlined" />
                  )}
                  {image.model && (
                    <Chip label={image.model} size="small" variant="outlined" />
                  )}
                  {image.cost && (
                    <Chip
                      label={`$${image.cost.toFixed(2)}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Stack>

                <Stack direction="row" spacing={1}>
                  {onDownload && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Download />}
                      onClick={() => onDownload(image)}
                      fullWidth
                    >
                      Download
                    </Button>
                  )}
                  {onSaveToLibrary && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FavoriteBorder />}
                      onClick={() => onSaveToLibrary(image)}
                      fullWidth
                    >
                      Save
                    </Button>
                  )}
                </Stack>

                {image.generation_time && (
                  <Typography variant="caption" color="text.secondary">
                    Generated in {image.generation_time.toFixed(1)}s
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </MotionCard>
        ))}
      </Box>
    </Stack>
  );
};

