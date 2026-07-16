import React from 'react';
import { Box, Chip, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LinkedInAuthenticatedImage } from './LinkedInAuthenticatedImage';
import type { LinkedInPublishMediaAttachment } from '../utils/linkedInPublishMediaUtils';

interface LinkedInPublishMediaPreviewProps {
  attachment: LinkedInPublishMediaAttachment;
  onRemove: () => void;
  compact?: boolean;
}

export const LinkedInPublishMediaPreview: React.FC<LinkedInPublishMediaPreviewProps> = ({
  attachment,
  onRemove,
  compact = false,
}) => {
  const sourceLabel = attachment.source === 'ai' ? 'AI Generated' : 'Uploaded';
  const sourceColor = attachment.source === 'ai' ? '#0A66C2' : '#059669';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        gap: 1.5,
        p: compact ? 1 : 1.5,
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        bgcolor: '#fff',
      }}
    >
      <Box
        sx={{
          width: compact ? 56 : 88,
          height: compact ? 56 : 88,
          borderRadius: 1.5,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f8fafc',
        }}
      >
        {attachment.source === 'ai' ? (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              '& img': {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                margin: '0 !important',
                maxHeight: 'none !important',
                borderRadius: 0,
              },
            }}
          >
            <LinkedInAuthenticatedImage imageId={attachment.imageId} alt={attachment.alt} />
          </Box>
        ) : (
          <Box
            component="img"
            src={attachment.previewUrl}
            alt={attachment.fileName}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Chip
            size="small"
            label={sourceLabel}
            sx={{
              height: 22,
              fontSize: 11,
              fontWeight: 600,
              bgcolor: `${sourceColor}14`,
              color: sourceColor,
              border: `1px solid ${sourceColor}33`,
            }}
          />
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: '#64748b',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {attachment.source === 'ai' ? attachment.alt : attachment.fileName}
        </Typography>
      </Box>

      <IconButton
        size="small"
        aria-label="Remove attached image"
        onClick={onRemove}
        sx={{ color: '#64748b' }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
