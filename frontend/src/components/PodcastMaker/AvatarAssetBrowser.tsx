import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Stack, 
  TextField, 
  InputAdornment, 
  RadioGroup, 
  FormControlLabel, 
  Radio, 
  Typography, 
  CircularProgress, 
  Alert, 
  Grid, 
  Card, 
  CardMedia, 
  Button,
  IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CollectionsIcon from '@mui/icons-material/Collections';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useContentAssets } from '../../hooks/useContentAssets';
import { fetchMediaBlobUrl } from '../../utils/fetchMediaBlobUrl';

interface AvatarAssetBrowserProps {
  onSelect: (url: string) => void;
  selectedUrl: string | null;
}

export const AvatarAssetBrowser: React.FC<AvatarAssetBrowserProps> = ({ onSelect, selectedUrl }) => {
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [search, setSearch] = useState('');
  const [imageBlobUrls, setImageBlobUrls] = useState<Map<number, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [limit, setLimit] = useState(24);

  const { assets, loading, error, total, toggleFavorite, refetch } = useContentAssets({
    asset_type: 'image',
    search: search || undefined,
    favorites_only: filter === 'favorites',
    limit: limit,
  });

  // No-op useEffect to satisfy the linter if needed, but the actual fetch is handled by useContentAssets hook's internal useEffect
  // which runs when stableFilters change.
  // The user reported that images don't load on initial tab mount unless toggled.
  // useContentAssets's useEffect(fetchAssets, [filterKey, fetchAssets]) should handle it,
  // but if it's failing initially due to auth timing, this manual refetch helps.
  useEffect(() => {
    // Only refetch on mount to ensure initial load
    const timer = setTimeout(() => {
      refetch();
    }, 200); // Slightly longer delay to ensure auth is fully ready
    return () => clearTimeout(timer);
  }, [refetch]); // Only run on mount or if refetch function changes

  // Check if a URL requires authentication (internal API endpoints)
  const isAuthenticatedUrl = React.useCallback((url: string): boolean => {
    if (!url) return false;
    return url.includes('/api/podcast/') || 
           url.includes('/api/youtube/') || 
           url.includes('/api/story/') ||
           (url.startsWith('/') && !url.startsWith('//'));
  }, []);

  // Load blob URLs for authenticated images
  useEffect(() => {
    if (assets.length === 0) {
      setImageBlobUrls(new Map());
      return;
    }

    const loadBlobUrls = async () => {
      const newBlobUrls = new Map<number, string>();
      const newLoadingImages = new Set<number>();

      for (const asset of assets) {
        if (!asset.file_url) continue;

        if (isAuthenticatedUrl(asset.file_url)) {
          newLoadingImages.add(asset.id);
          try {
            const blobUrl = await fetchMediaBlobUrl(asset.file_url);
            if (blobUrl) {
              newBlobUrls.set(asset.id, blobUrl);
            }
          } catch (err) {
            console.error(`Failed to load image for asset ${asset.id}:`, err);
          } finally {
            newLoadingImages.delete(asset.id);
          }
        } else {
          newBlobUrls.set(asset.id, asset.file_url);
        }
      }

      setImageBlobUrls(prev => {
         // Revoke old blobs that are no longer needed
         prev.forEach((url, id) => {
             if (url.startsWith('blob:') && !newBlobUrls.has(id)) URL.revokeObjectURL(url);
         });
         return newBlobUrls;
      });
      setLoadingImages(newLoadingImages);
    };

    loadBlobUrls();
    
    // Cleanup on unmount/change is handled by the effect below or next run
  }, [assets, isAuthenticatedUrl]);

  // Cleanup all blobs on unmount
  useEffect(() => {
      return () => {
          imageBlobUrls.forEach(url => {
              if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          });
      };
  }, [imageBlobUrls]); 

  const handleLoadMore = () => {
    setLimit(prev => prev + 24);
  };

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, width: '100%' }}>
            <TextField
                sx={{ 
                    flexGrow: 1,
                    bgcolor: 'white',
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '& fieldset': { borderColor: '#e2e8f0' },
                        '&:hover fieldset': { borderColor: '#cbd5e1' },
                        '&.Mui-focused fieldset': { borderColor: '#667eea' },
                        '& .MuiOutlinedInput-input': {
                            color: '#0f172a',
                            py: 1,
                            '&::placeholder': {
                                color: '#94a3b8',
                                opacity: 1,
                            }
                        }
                    }
                }}
                size="small"
                placeholder="Search images..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
                        </InputAdornment>
                    ),
                }}
            />
            
            <RadioGroup
                row
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'favorites')}
                sx={{ 
                    flexShrink: 0,
                    ml: 0.5,
                    display: 'flex',
                    flexWrap: 'nowrap',
                    '& .MuiFormControlLabel-root': {
                        mr: 0.5,
                        ml: 0,
                        '& .MuiTypography-root': {
                            color: '#334155',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap'
                        },
                        '& .MuiRadio-root': {
                            p: 0.5,
                            color: '#94a3b8',
                            '&.Mui-checked': {
                                color: '#667eea',
                            }
                        }
                    }
                }}
            >
                <FormControlLabel 
                    value="all" 
                    control={<Radio size="small" />} 
                    label="All" 
                />
                <FormControlLabel 
                    value="favorites" 
                    control={<Radio size="small" />} 
                    label="Favs" 
                />
            </RadioGroup>
        </Stack>

        {loading && assets.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
            </Box>
        ) : error ? (
            <Alert severity="error">{error}</Alert>
        ) : assets.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <CollectionsIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                    {search ? 'No matches found' : 'No images in library'}
                </Typography>
            </Box>
        ) : (
            <>
                <Grid container spacing={1.5} sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
                    {assets.map((asset) => (
                        <Grid item xs={6} sm={4} key={asset.id}>
                            <Card 
                                sx={{ 
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: selectedUrl === asset.file_url ? '2px solid #667eea' : '1px solid #e2e8f0',
                                    '&:hover': { borderColor: '#667eea' }
                                }}
                                onClick={() => asset.file_url && onSelect(asset.file_url)}
                            >
                                <Box sx={{ position: 'relative', paddingTop: '100%' }}>
                                    {isAuthenticatedUrl(asset.file_url) && !imageBlobUrls.has(asset.id) ? (
                                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
                                            <CircularProgress size={20} />
                                        </Box>
                                    ) : (
                                        <CardMedia
                                            component="img"
                                            image={imageBlobUrls.get(asset.id) || asset.file_url || ''}
                                            sx={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    )}
                                    {loadingImages.has(asset.id) && (
                                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.7)' }}>
                                            <CircularProgress size={20} />
                                        </Box>
                                    )}
                                    <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(asset.id);
                                            }}
                                            sx={{ 
                                                bgcolor: 'rgba(255,255,255,0.8)', 
                                                '&:hover': { bgcolor: 'white' },
                                                width: 24,
                                                height: 24,
                                                p: 0.5
                                            }}
                                        >
                                            {asset.is_favorite ? <FavoriteIcon fontSize="small" color="error" /> : <FavoriteBorderIcon fontSize="small" />}
                                        </IconButton>
                                        {selectedUrl === asset.file_url && (
                                            <Box sx={{ bgcolor: '#667eea', borderRadius: '50%', p: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                                                <CheckCircleIcon sx={{ color: 'white', fontSize: 16 }} />
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                    
                    {/* Load More Button */}
                    {total > limit && (
                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', mt: 2, pb: 1 }}>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                onClick={handleLoadMore}
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={16} /> : <ExpandMoreIcon />}
                            >
                                {loading ? 'Loading...' : 'Load More'}
                            </Button>
                        </Grid>
                    )}
                </Grid>
            </>
        )}
      </Stack>
    </Box>
  );
};
