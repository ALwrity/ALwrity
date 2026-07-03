import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Download,
  Share,
  Delete,
  Favorite,
  FavoriteBorder,
  TextFields,
  ExpandLess,
} from '@mui/icons-material';
import { ContentAsset } from '../../../hooks/useContentAssets';
import { getStatusChip, formatDate, getAssetIcon } from './utils';

interface AssetCardProps {
  asset: ContentAsset;
  textPreview?: { content: string; loading: boolean; expanded: boolean };
  onToggleTextPreview?: (asset: ContentAsset) => void;
  onFavorite: (id: number) => void;
  onDownload: (asset: ContentAsset) => void;
  onShare: (asset: ContentAsset) => void;
  onDelete: (id: number) => void;
  onRestore: (asset: ContentAsset) => void;
  onOpenBlogAsset?: (asset: ContentAsset) => void;
  onOpenLinkedInAsset?: (asset: ContentAsset) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  textPreview,
  onToggleTextPreview,
  onFavorite,
  onDownload,
  onShare,
  onDelete,
  onRestore,
  onOpenBlogAsset,
  onOpenLinkedInAsset,
}) => {
  return (
    <Card
      sx={{
        background: 'rgba(15,23,42,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 10px 25px rgba(124,58,237,0.25)',
        },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: asset.asset_type === 'video' ? '16/9' : '1' }}>
        {asset.asset_type === 'image' ? (
          <CardMedia
            component="img"
            image={asset.file_url}
            alt={asset.title || asset.filename}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : asset.asset_type === 'video' ? (
          <Box
            component="video"
            src={asset.file_url}
            controls
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : asset.asset_type === 'text' ? (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              p: 2,
              background: 'rgba(107,114,128,0.2)',
              color: '#d1d5db',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {textPreview?.loading ? (
              <CircularProgress size={24} sx={{ m: 'auto' }} />
            ) : textPreview?.expanded ? (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                  }}
                >
                  {textPreview.content}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTextPreview && onToggleTextPreview(asset);
                  }}
                  sx={{ alignSelf: 'flex-end', mt: 1 }}
                >
                  <ExpandLess />
                </IconButton>
              </>
            ) : (
              <>
                <TextFields sx={{ fontSize: 48, mb: 1, opacity: 0.7 }} />
                <Typography variant="body2" sx={{ textAlign: 'center', mb: 1 }}>
                  Text Content
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTextPreview && onToggleTextPreview(asset);
                  }}
                  sx={{ mt: 'auto' }}
                >
                  Preview
                </Button>
              </>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(99,102,241,0.2)',
              color: '#c7d2fe',
            }}
          >
            {getAssetIcon(asset.asset_type)}
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 1,
          }}
        >
          <IconButton
            size="small"
            onClick={() => onFavorite(asset.id)}
            sx={{
              background: 'rgba(15,23,42,0.8)',
              color: asset.is_favorite ? '#fbbf24' : 'rgba(255,255,255,0.6)',
              '&:hover': { background: 'rgba(15,23,42,0.95)' },
            }}
          >
            {asset.is_favorite ? <Favorite /> : <FavoriteBorder />}
          </IconButton>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
          }}
        >
          <Chip
            label={asset.source_module.replace(/_/g, ' ')}
            size="small"
            sx={{
              background: 'rgba(15,23,42,0.8)',
              color: '#c7d2fe',
              fontSize: '0.7rem',
            }}
          />
        </Box>
      </Box>
      <CardContent>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom noWrap>
          {asset.title || asset.filename}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
          {getStatusChip(asset.asset_metadata?.status || 'completed')}
          <Chip
            label={asset.asset_type}
            size="small"
            sx={{ background: 'rgba(99,102,241,0.2)', color: '#c7d2fe' }}
          />
          {asset.cost > 0 && (
            <Chip
              label={`$${asset.cost.toFixed(2)}`}
              size="small"
              sx={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}
            />
          )}
        </Stack>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1 }}>
          {formatDate(asset.created_at)}
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {/* Restore Research Project button for research_tools assets */}
          {asset.source_module === 'research_tools' && asset.asset_type === 'text' && asset.asset_metadata?.project_type === 'research_project' && (
            <Tooltip title="Restore in Researcher">
              <IconButton
                size="small"
                onClick={() => onRestore(asset)}
                sx={{ color: '#667eea' }}
              >
                <Box sx={{ fontSize: 20 }}>🔬</Box>
              </IconButton>
            </Tooltip>
          )}
          {/* Open Blog Asset button for blog_writer text assets */}
          {asset.source_module === 'blog_writer' && asset.asset_type === 'text' && onOpenBlogAsset && (
            <Tooltip title="Open in Blog Writer">
              <IconButton
                size="small"
                onClick={() => onOpenBlogAsset(asset)}
                sx={{ color: '#3b82f6' }}
              >
                <Box sx={{ fontSize: 20 }}>✏️</Box>
              </IconButton>
            </Tooltip>
          )}
          {/* Open LinkedIn Asset button for linkedin_writer text assets */}
          {asset.source_module === 'linkedin_writer' && asset.asset_type === 'text' && onOpenLinkedInAsset && (
            <Tooltip title="Edit in LinkedIn Studio">
              <IconButton
                size="small"
                onClick={() => onOpenLinkedInAsset(asset)}
                sx={{ color: '#0a66c2' }}
              >
                <Box sx={{ fontSize: 20 }}>📝</Box>
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            size="small"
            onClick={() => onDownload(asset)}
            sx={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <Download />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onShare(asset)}
            sx={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <Share />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(asset.id)}
            sx={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <Delete />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
};
