import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  Chip,
} from '@mui/material';
import OpenInNew from '@mui/icons-material/OpenInNew';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import Refresh from '@mui/icons-material/Refresh';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import { motion } from 'framer-motion';
import { useContentAssets, ContentAsset } from '../../../hooks/useContentAssets';
import { useNavigate } from 'react-router-dom';

const MotionCard = motion.create(Card);

interface ProductAssetsGalleryProps {
  limit?: number;
  onAssetSelect?: (asset: ContentAsset) => void;
  showViewAllButton?: boolean;
  refreshKey?: number; // Trigger refresh when this changes
}

export const ProductAssetsGallery: React.FC<ProductAssetsGalleryProps> = ({
  limit = 6,
  onAssetSelect,
  showViewAllButton = true,
  refreshKey = 0,
}) => {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  // Filter for product marketing images
  const filters = {
    asset_type: 'image' as const,
    source_module: 'product_marketing',
    tags: ['product_marketing', 'product_image'],
    limit: limit,
    offset: 0,
  };

  const { assets, loading, error, refetch, toggleFavorite } = useContentAssets(filters);

  // Refresh when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleViewInLibrary = () => {
    navigate('/image-studio/asset-library', {
      state: { filters: { source_module: 'product_marketing', asset_type: 'image' } },
    });
  };

  if (loading && assets.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load product images: {error}
      </Alert>
    );
  }

  if (assets.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
          px: 2,
        }}
      >
        <PhotoLibrary sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
        <Typography variant="body1" color="text.secondary" gutterBottom>
          No product images yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Generate your first product image to see it here
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight={600}>
          Your Product Images ({assets.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton
              size="small"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <Refresh />
            </IconButton>
          </Tooltip>
          {showViewAllButton && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNew />}
              onClick={handleViewInLibrary}
            >
              View All in Library
            </Button>
          )}
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {assets.map((asset, index) => (
          <Grid item xs={6} sm={4} md={3} key={asset.id}>
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              sx={{
                cursor: onAssetSelect ? 'pointer' : 'default',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  transform: 'translateY(-4px)',
                },
                transition: 'all 0.2s',
              }}
              onClick={() => onAssetSelect?.(asset)}
            >
              {asset.file_url ? (
                <CardMedia
                  component="img"
                  image={asset.file_url}
                  alt={asset.title || 'Product image'}
                  sx={{
                    height: 150,
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    height: 150,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <PhotoLibrary sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
              )}

              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {asset.title || 'Untitled'}
                  </Typography>

                  <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                    {asset.provider && (
                      <Chip
                        label={asset.provider}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                    {asset.tags?.slice(0, 1).map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    ))}
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {asset.created_at
                        ? new Date(asset.created_at).toLocaleDateString()
                        : 'Recent'}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(asset.id);
                      }}
                      sx={{ p: 0.5 }}
                    >
                      {asset.is_favorite ? (
                        <Favorite sx={{ fontSize: 18, color: '#ef4444' }} />
                      ) : (
                        <FavoriteBorder sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </MotionCard>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
};

