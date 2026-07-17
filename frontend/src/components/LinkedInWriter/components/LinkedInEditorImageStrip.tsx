import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LinkedInAuthenticatedImage } from './LinkedInAuthenticatedImage';
import type { LinkedInEditorImageBlock } from '../utils/linkedInEditorDraftUtils';

interface LinkedInEditorImageStripProps {
  images: LinkedInEditorImageBlock[];
  onRemove: (imageId: string) => void;
}

/**
 * Inline image previews below the assistive editor textarea (LinkedIn-style media strip).
 */
export const LinkedInEditorImageStrip: React.FC<LinkedInEditorImageStripProps> = ({
  images,
  onRemove,
}) => {
  if (images.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        mt: 1.5,
        pt: 1.5,
        borderTop: '1px solid #e2e8f0',
      }}
    >
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
        Photos ({images.length})
      </Typography>

      {images.map((image) => (
        <Box
          key={image.id}
          sx={{
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            bgcolor: '#fff',
          }}
        >
          {image.imageId ? (
            <LinkedInAuthenticatedImage imageId={image.imageId} alt={image.alt} />
          ) : (
            <Box
              component="img"
              src={image.url}
              alt={image.alt}
              sx={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }}
            />
          )}

          <IconButton
            size="small"
            aria-label="Remove image"
            onClick={() => onRemove(image.id)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(255,255,255,0.92)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              '&:hover': { bgcolor: '#fff' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
};
