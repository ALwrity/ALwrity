import React, { useState } from 'react';
import {
  Box,
  Card,
  CardMedia,
  CardActions,
  IconButton,
  Grid,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Chip,
  Stack,
  Tooltip,
  alpha,
  Paper,
  Divider,
} from '@mui/material';
import Download from '@mui/icons-material/Download';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import ZoomIn from '@mui/icons-material/ZoomIn';
import Close from '@mui/icons-material/Close';
import Share from '@mui/icons-material/Share';
import Edit from '@mui/icons-material/Edit';
import ContentCopy from '@mui/icons-material/ContentCopy';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { motion, AnimatePresence, type Variants, type Easing } from 'framer-motion';

const MotionCard = motion.create(Card);
const MotionBox = motion.create(Box);
const galleryEase: Easing = [0.4, 0, 0.2, 1];

interface ImageResult {
  image_base64: string;
  width: number;
  height: number;
  provider: string;
  model: string;
  seed?: number;
  variation: number;
  metadata?: any;
}

interface ImageResultsGalleryProps {
  results: ImageResult[];
  onImageSelect?: (image: ImageResult) => void;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: galleryEase },
  },
  hover: {
    y: -8,
    transition: { duration: 0.2, ease: galleryEase },
  },
};

export const ImageResultsGallery: React.FC<ImageResultsGalleryProps> = ({
  results,
  onImageSelect,
}) => {
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [downloadedImages, setDownloadedImages] = useState<Set<number>>(new Set());

  // Handle favorite toggle
  const toggleFavorite = (index: number) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(index)) {
        newFavorites.delete(index);
      } else {
        newFavorites.add(index);
      }
      return newFavorites;
    });
  };

  // Handle download
  const handleDownload = (image: ImageResult, index: number) => {
    try {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${image.image_base64}`;
      link.download = `generated-image-${Date.now()}-v${image.variation}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Mark as downloaded
      setDownloadedImages((prev) => new Set(prev).add(index));
      
      // Remove downloaded indicator after 2 seconds
      setTimeout(() => {
        setDownloadedImages((prev) => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Handle copy to clipboard
  const handleCopy = async (image: ImageResult) => {
    try {
      // Convert base64 to blob
      const response = await fetch(`data:image/png;base64,${image.image_base64}`);
      const blob = await response.blob();
      
      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      
      alert('Image copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy image');
    }
  };

  return (
    <>
      <Grid container spacing={2}>
        <AnimatePresence mode="popLayout">
          {results.map((result, index) => {
            const isFavorite = favorites.has(index);
            const isDownloaded = downloadedImages.has(index);

            return (
              <Grid item xs={12} sm={6} key={`${result.variation}-${index}`}>
                <MotionCard
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  sx={{
                    position: 'relative',
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: isFavorite ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                    boxShadow: isFavorite
                      ? '0 8px 24px rgba(245, 158, 11, 0.2)'
                      : '0 4px 12px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 12px 32px rgba(102, 126, 234, 0.2)',
                    },
                  }}
                >
                  {/* Favorite Badge */}
                  {isFavorite && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 2,
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#fff',
                        borderRadius: 2,
                        px: 1,
                        py: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                      }}
                    >
                      <Favorite sx={{ fontSize: 14 }} />
                      Favorite
                    </Box>
                  )}

                  {/* Downloaded Indicator */}
                  {isDownloaded && (
                    <MotionBox
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        zIndex: 2,
                        background: '#10b981',
                        color: '#fff',
                        borderRadius: 2,
                        px: 1,
                        py: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle sx={{ fontSize: 14 }} />
                      Downloaded
                    </MotionBox>
                  )}

                  {/* Image */}
                  <Box
                    sx={{
                      position: 'relative',
                      paddingTop: `${(result.height / result.width) * 100}%`,
                      overflow: 'hidden',
                      background: '#f8fafc',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedImage(result)}
                  >
                    <CardMedia
                      component="img"
                      image={`data:image/png;base64,${result.image_base64}`}
                      alt={`Generated variation ${result.variation}`}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        },
                      }}
                    />
                    
                    {/* Hover Overlay */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': {
                          opacity: 1,
                        },
                      }}
                    >
                      <IconButton
                        sx={{
                          background: '#fff',
                          '&:hover': {
                            background: '#f8fafc',
                          },
                        }}
                      >
                        <ZoomIn />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Metadata */}
                  <Box sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        label={`Variation ${result.variation}`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'linear-gradient(90deg, #667eea, #764ba2)',
                          color: '#fff',
                        }}
                      />
                      <Chip
                        label={`${result.width}×${result.height}`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 600,
                          background: '#f1f5f9',
                        }}
                      />
                      <Chip
                        label={result.provider}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 600,
                          background: alpha('#667eea', 0.1),
                          color: '#667eea',
                        }}
                      />
                    </Stack>
                  </Box>

                  {/* Actions */}
                  <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
                    <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleFavorite(index)}
                        sx={{
                          color: isFavorite ? '#f59e0b' : 'text.secondary',
                          '&:hover': {
                            background: alpha('#f59e0b', 0.1),
                            color: '#f59e0b',
                          },
                        }}
                      >
                        {isFavorite ? <Favorite /> : <FavoriteBorder />}
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Download image">
                      <IconButton
                        size="small"
                        onClick={() => handleDownload(result, index)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            background: alpha('#10b981', 0.1),
                            color: '#10b981',
                          },
                        }}
                      >
                        <Download />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Copy to clipboard">
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(result)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            background: alpha('#667eea', 0.1),
                            color: '#667eea',
                          },
                        }}
                      >
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>

                    <Box sx={{ flex: 1 }} />

                    <Tooltip title="View full size">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedImage(result)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            background: alpha('#667eea', 0.1),
                            color: '#667eea',
                          },
                        }}
                      >
                        <ZoomIn />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </MotionCard>
              </Grid>
            );
          })}
        </AnimatePresence>
      </Grid>

      {/* Full Size Dialog */}
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: '#1e293b',
          },
        }}
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          {selectedImage && (
            <>
              <IconButton
                onClick={() => setSelectedImage(null)}
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  zIndex: 2,
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: '#fff',
                  '&:hover': {
                    background: 'rgba(0, 0, 0, 0.8)',
                  },
                }}
              >
                <Close />
              </IconButton>
              
              <img
                src={`data:image/png;base64,${selectedImage.image_base64}`}
                alt="Full size"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />
              
              {/* Metadata Overlay */}
              <Paper
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(0, 0, 0, 0.8)',
                  backdropFilter: 'blur(10px)',
                  p: 2,
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={`${selectedImage.width}×${selectedImage.height}`}
                      size="small"
                      sx={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    />
                    <Chip
                      label={selectedImage.provider}
                      size="small"
                      sx={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    />
                    <Chip
                      label={selectedImage.model}
                      size="small"
                      sx={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    />
                  </Stack>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    startIcon={<Download />}
                    onClick={() => {
                      const index = results.findIndex(r => r === selectedImage);
                      if (index !== -1) {
                        handleDownload(selectedImage, index);
                      }
                    }}
                    sx={{
                      background: 'linear-gradient(90deg, #667eea, #764ba2)',
                      color: '#fff',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(90deg, #5568d3, #65408b)',
                      },
                    }}
                  >
                    Download
                  </Button>
                </Stack>
              </Paper>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

