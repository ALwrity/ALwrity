import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  // Button,
} from '@mui/material';
import VideoLibrary from '@mui/icons-material/VideoLibrary';
import AudioFile from '@mui/icons-material/AudioFile';
import TextFields from '@mui/icons-material/TextFields';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { ContentAsset } from '../../../hooks/useContentAssets';

interface AssetPreviewProps {
  asset: ContentAsset;
  isListView?: boolean;
  textPreview?: { content: string; loading: boolean; expanded: boolean };
  onToggleTextPreview?: (asset: ContentAsset) => void;
}

export const AssetPreview: React.FC<AssetPreviewProps> = ({
  asset,
  isListView = false,
  textPreview,
  onToggleTextPreview,
}) => {
  if (asset.asset_type === 'image') {
    return (
      <Box
        component="img"
        src={asset.file_url}
        alt={asset.title || asset.filename}
        sx={{
          width: 80,
          height: 80,
          objectFit: 'cover',
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
        onClick={() => window.open(asset.file_url, '_blank')}
      />
    );
  } else if (asset.asset_type === 'video') {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: 1,
          background: 'rgba(99,102,241,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
        onClick={() => window.open(asset.file_url, '_blank')}
      >
        <VideoLibrary sx={{ color: '#c7d2fe', fontSize: 32 }} />
      </Box>
    );
  } else if (asset.asset_type === 'audio') {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: 1,
          background: 'rgba(59,130,246,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
        onClick={() => window.open(asset.file_url, '_blank')}
      >
        <AudioFile sx={{ color: '#93c5fd', fontSize: 32 }} />
      </Box>
    );
  } else if (asset.asset_type === 'text') {
    const previewText = textPreview?.content || '';
    const lines = previewText.split('\n');
    const previewLines = lines.slice(0, 2).join('\n');
    const hasMore = lines.length > 2 || previewText.length > 100;
    
    return (
      <Box
        sx={{
          width: isListView ? 'auto' : 80,
          minHeight: isListView ? 'auto' : 80,
          maxWidth: isListView ? 300 : 80,
          borderRadius: 1,
          background: 'rgba(107,114,128,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          p: isListView ? 1.5 : 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleTextPreview && onToggleTextPreview(asset);
        }}
      >
        {textPreview?.loading ? (
          <CircularProgress size={20} sx={{ m: 'auto' }} />
        ) : textPreview?.expanded ? (
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto', 
            fontSize: isListView ? '0.8rem' : '0.7rem', 
            color: '#d1d5db',
            maxHeight: isListView ? 200 : 150,
          }}>
            <Typography 
              variant="caption" 
              sx={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                fontFamily: isListView ? 'monospace' : 'inherit',
                lineHeight: 1.5,
              }}
            >
              {previewText.substring(0, isListView ? 1000 : 500)}
              {previewText.length > (isListView ? 1000 : 500) && '...'}
            </Typography>
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                onToggleTextPreview && onToggleTextPreview(asset);
              }}
              sx={{ position: 'absolute', bottom: 4, right: 4, p: 0.5 }}
            >
              <ExpandLess sx={{ fontSize: 16, color: '#d1d5db' }} />
            </IconButton>
          </Box>
        ) : (
          <>
            <TextFields sx={{ color: '#d1d5db', fontSize: isListView ? 28 : 24, mb: 0.5 }} />
            {previewText ? (
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: isListView ? '0.75rem' : '0.65rem', 
                  color: '#9ca3af', 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: isListView ? 3 : 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.3,
                  mb: 0.5,
                }}
              >
                {previewLines || previewText.substring(0, 100)}
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                Click to preview
              </Typography>
            )}
            {hasMore && (
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTextPreview && onToggleTextPreview(asset);
                }}
                sx={{ position: 'absolute', bottom: 4, right: 4, p: 0.5 }}
              >
                <ExpandMore sx={{ fontSize: 16, color: '#d1d5db' }} />
              </IconButton>
            )}
          </>
        )}
      </Box>
    );
  } else {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: 1,
          background: 'rgba(107,114,128,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
        onClick={() => window.open(asset.file_url, '_blank')}
      >
        <TextFields sx={{ color: '#d1d5db', fontSize: 32 }} />
      </Box>
    );
  }
};
