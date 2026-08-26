import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Alert,
  Tooltip,
  Stack,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import Close from '@mui/icons-material/Close';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Collections from '@mui/icons-material/Collections';
import { useContentAssets, ContentAsset } from '../../hooks/useContentAssets';
import { isAuthenticatedAssetUrl, useAssetAuthUrls } from '../../hooks/useAssetAuthUrls';
import { getLatestBrandAvatar, AssetResponse as BrandAvatarResponse } from '../../api/brandAssets';

export interface AssetLibraryImageModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: ContentAsset) => void;
  title?: string;
  sourceModule?: string | string[]; // Optional filter by source module(s) (e.g., 'youtube_creator', 'podcast_maker', or ['youtube_creator', 'podcast_maker'])
  allowFavoritesOnly?: boolean; // Optional favorites-only filter toggle
  showBrandAvatarShortcut?: boolean; // Optional shortcut to show latest onboarding brand avatar
}

/**
 * Reusable modal to browse and pick images from the Asset Library.
 * Image-only, with search and optional favorites/source filtering.
 */
export const AssetLibraryImageModal: React.FC<AssetLibraryImageModalProps> = ({
  open,
  onClose,
  onSelect,
  title = 'Select Image from Asset Library',
  sourceModule,
  allowFavoritesOnly = false,
  showBrandAvatarShortcut = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ContentAsset | null>(null);
  const [page, setPage] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [brandAvatar, setBrandAvatar] = useState<BrandAvatarResponse | null>(null);
  const [brandAvatarLoading, setBrandAvatarLoading] = useState(false);
  const [brandAvatarError, setBrandAvatarError] = useState<string | null>(null);
  const pageSize = 24;

  // Filter for images only
  const filters = {
    asset_type: 'image' as const,
    source_module: sourceModule,
    search: searchQuery || undefined,
    favorites_only: allowFavoritesOnly && favoritesOnly ? true : undefined,
    limit: pageSize,
    offset: page * pageSize,
  };

  const { assets, loading, error, total, toggleFavorite, refetch } = useContentAssets(filters);

  // Securely and efficiently resolve authenticated URLs for all assets and the brand avatar
  const {
    imageAuthUrls,
    loadingImages,
    brandAvatarAuthUrl,
  } = useAssetAuthUrls(open, assets, brandAvatar?.image_url);

  const isBrandAvatarAuthPending = !!brandAvatar?.image_url &&
    isAuthenticatedAssetUrl(brandAvatar.image_url) &&
    !brandAvatarAuthUrl;

  // Load latest brand avatar generated in onboarding (Step 4)
  useEffect(() => {
    if (!open || !showBrandAvatarShortcut) {
      setBrandAvatar(null);
      setBrandAvatarError(null);
      setBrandAvatarLoading(false);
      return;
    }

    let cancelled = false;

    const loadBrandAvatar = async () => {
      try {
        setBrandAvatarLoading(true);
        setBrandAvatarError(null);
        const response = await getLatestBrandAvatar();
        if (cancelled) return;

        if (response.success && response.image_url) {
          setBrandAvatar(response);
        } else {
          // No brand avatar yet — expected for new users, not an error
          setBrandAvatar(null);
          setBrandAvatarError(null);
        }
      } catch (err: any) {
        if (cancelled) return;
        // Only log genuinely unexpected errors (5xx, network failures)
        console.error('[AssetLibraryImageModal] Unexpected error loading brand avatar:', err);
        setBrandAvatar(null);
        setBrandAvatarError('Failed to load brand avatar');
      } finally {
        if (!cancelled) {
          setBrandAvatarLoading(false);
        }
      }
    };

    loadBrandAvatar();

    return () => {
      cancelled = true;
    };
  }, [open, showBrandAvatarShortcut]);

  const handleSelect = useCallback(() => {
    if (selectedAsset) {
      onSelect(selectedAsset);
      handleClose();
    }
  }, [selectedAsset, onSelect]);

  const handleClose = useCallback(() => {
    onClose();
    setSelectedAsset(null);
    setSearchQuery('');
    setPage(0);
    setFavoritesOnly(false);
  }, [onClose]);

  const handleAssetClick = useCallback((asset: ContentAsset) => {
    setSelectedAsset(asset);
  }, []);

  const handleBrandAvatarSelect = useCallback(() => {
    if (!brandAvatar || !brandAvatar.image_url) return;

    const now = new Date().toISOString();

    const asset: ContentAsset = {
      id: brandAvatar.asset_id ?? -1,
      user_id: 'current_user',
      asset_type: 'image',
      source_module: 'brand_avatar_generator',
      filename: brandAvatar.image_url,
      file_url: brandAvatar.image_url,
      file_path: undefined,
      file_size: undefined,
      mime_type: 'image/png',
      title: 'Brand Avatar',
      description: brandAvatar.prompt || 'Brand avatar from onboarding',
      prompt: brandAvatar.prompt,
      tags: ['brand_avatar', 'onboarding'],
      asset_metadata: {
        source: 'onboarding_step4',
      },
      provider: undefined,
      model: undefined,
      cost: 0,
      generation_time: undefined,
      is_favorite: false,
      download_count: 0,
      share_count: 0,
      created_at: now,
      updated_at: now,
    };

    onSelect(asset);
    handleClose();
  }, [brandAvatar, onSelect, handleClose]);

  const handleFavoriteToggle = useCallback(
    async (assetId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await toggleFavorite(assetId);
        refetch();
      } catch (err) {
        console.error('Error toggling favorite:', err);
      }
    },
    [toggleFavorite, refetch]
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Collections sx={{ color: '#FF0000' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
              {title}
            </Typography>
          </Stack>
          <IconButton onClick={handleClose} size="small" sx={{ color: '#6b7280' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ backgroundColor: '#f9fafb' }}>
        {/* Brand Avatar Shortcut (from Onboarding Step 4) */}
        {showBrandAvatarShortcut && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#111827' }}>
                Brand Avatar from Onboarding
              </Typography>
              {brandAvatarLoading && <CircularProgress size={18} />}
            </Stack>
            {brandAvatarError && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {brandAvatarError}
              </Alert>
            )}
            {!brandAvatarLoading && !brandAvatar && !brandAvatarError && (
              <Typography variant="body2" sx={{ color: '#6b7280' }}>
                No brand avatar found. Create one in Step 4 of onboarding to see it here.
              </Typography>
            )}
            {!brandAvatarLoading && brandAvatar && brandAvatar.image_url && (
              <Card
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  mb: 1.5,
                  '&:hover': {
                    boxShadow: 3,
                    borderColor: '#9ca3af',
                  },
                }}
                onClick={handleBrandAvatarSelect}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 2,
                    overflow: 'hidden',
                    mr: 2,
                    bgcolor: '#f3f4f6',
                  }}
                >
                  {isBrandAvatarAuthPending ? (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#f3f4f6',
                      }}
                    >
                      <CircularProgress size={16} />
                    </Box>
                  ) : (
                    <CardMedia
                      component="img"
                      image={brandAvatarAuthUrl || brandAvatar.image_url}
                      alt="Brand Avatar"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                    Use Brand Avatar
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6b7280' }}>
                    Quickly apply the avatar you created during onboarding.
                  </Typography>
                </Box>
              </Card>
            )}
          </Box>
        )}

        {/* Search and Filters */}
        <Box sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              fullWidth
              placeholder="Search images by title, description, or tags..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#9ca3af' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#ffffff',
                  '& fieldset': {
                    borderColor: '#d1d5db',
                  },
                },
              }}
            />
            {allowFavoritesOnly && (
              <Button
                variant={favoritesOnly ? 'contained' : 'outlined'}
                startIcon={<Favorite />}
                onClick={() => {
                  setFavoritesOnly(!favoritesOnly);
                  setPage(0);
                }}
                sx={{
                  minWidth: 160,
                  borderColor: '#d1d5db',
                  color: favoritesOnly ? '#ffffff' : '#6b7280',
                  bgcolor: favoritesOnly ? '#ef4444' : 'transparent',
                  '&:hover': {
                    borderColor: '#9ca3af',
                    bgcolor: favoritesOnly ? '#dc2626' : '#f9fafb',
                  },
                }}
              >
                {favoritesOnly ? 'Favorites' : 'All Images'}
              </Button>
            )}
          </Stack>
          <Typography variant="body2" sx={{ color: '#6b7280', mt: 1.5 }}>
            {loading
              ? 'Loading...'
              : total > 0
              ? `${total} image${total !== 1 ? 's' : ''} found`
              : 'No images found'}
          </Typography>
        </Box>

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && assets.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : assets.length === 0 ? (
          /* Empty State */
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Collections sx={{ fontSize: 64, color: '#d1d5db', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#6b7280', mb: 1 }}>
              {searchQuery ? 'No images found matching your search.' : 'No images in your asset library yet.'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              {searchQuery ? 'Try a different search term.' : 'Generate some images first to see them here.'}
            </Typography>
          </Box>
        ) : (
          /* Image Grid */
          <Box
            sx={{
              maxHeight: 'calc(90vh - 280px)',
              overflowY: 'auto',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: '#f1f5f9',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#cbd5e1',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: '#94a3b8',
                },
              },
            }}
          >
            <Grid container spacing={2}>
              {assets.map((asset) => {
                const requiresAuth = !!asset.file_url && isAuthenticatedAssetUrl(asset.file_url);
                const resolvedImageUrl = imageAuthUrls.get(asset.id);
                const displayImageUrl = requiresAuth ? resolvedImageUrl : asset.file_url;
                const shouldShowImageLoader = loadingImages.has(asset.id) || (requiresAuth && !displayImageUrl);

                return (
                <Grid item xs={6} sm={4} md={3} key={asset.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      position: 'relative',
                      border: selectedAsset?.id === asset.id ? '2px solid #FF0000' : '1px solid #e5e7eb',
                      borderRadius: 2,
                      overflow: 'hidden',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: 4,
                        borderColor: selectedAsset?.id === asset.id ? '#FF0000' : '#9ca3af',
                        transform: 'translateY(-2px)',
                      },
                    }}
                    onClick={() => handleAssetClick(asset)}
                  >
                    {/* Image */}
                    <Box sx={{ position: 'relative', paddingTop: '100%' }}>
                      {shouldShowImageLoader ? (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f3f4f6',
                          }}
                        >
                          <CircularProgress size={24} />
                        </Box>
                      ) : (
                        <CardMedia
                          component="img"
                          image={displayImageUrl || ''}
                          alt={asset.title || 'Asset'}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            bgcolor: '#f3f4f6', // Fallback background while loading
                          }}
                          onError={(e) => {
                            // Fallback if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      )}

                      {/* Selected Indicator */}
                      {selectedAsset?.id === asset.id && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            bgcolor: '#FF0000',
                            borderRadius: '50%',
                            p: 0.5,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        >
                          <CheckCircle sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                      )}

                      {/* Favorite Button */}
                      <Tooltip title={asset.is_favorite ? 'Remove from favorites' : 'Add to favorites'}>
                        <IconButton
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            bgcolor: 'rgba(255, 255, 255, 0.9)',
                            '&:hover': { bgcolor: 'white' },
                            transition: 'all 0.2s',
                          }}
                          onClick={(e) => handleFavoriteToggle(asset.id, e)}
                        >
                          {asset.is_favorite ? (
                            <Favorite sx={{ color: '#ef4444', fontSize: 18 }} />
                          ) : (
                            <FavoriteBorder sx={{ color: '#6b7280', fontSize: 18 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Title */}
                    {asset.title && (
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            fontWeight: 500,
                            color: '#111827',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={asset.title}
                        >
                          {asset.title}
                        </Typography>
                        {asset.source_module && (
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              color: '#6b7280',
                              fontSize: '0.7rem',
                              mt: 0.25,
                            }}
                          >
                            {asset.source_module.replace('_', ' ')}
                          </Typography>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </Grid>
                );
              })}
            </Grid>

            {/* Load More (if needed) */}
            {total > (page + 1) * pageSize && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Button variant="outlined" onClick={() => setPage(page + 1)} disabled={loading}>
                  {loading ? <CircularProgress size={20} /> : 'Load More'}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb' }}>
        <Button onClick={handleClose} sx={{ color: '#6b7280' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSelect}
          disabled={!selectedAsset}
          startIcon={selectedAsset ? <CheckCircle /> : undefined}
          sx={{
            minWidth: 140,
            '&:disabled': {
              backgroundColor: '#e5e7eb',
              color: '#9ca3af',
            },
          }}
        >
          Select Image
        </Button>
      </DialogActions>
    </Dialog>
  );
};

