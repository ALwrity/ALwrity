import React from 'react';
import {
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TableCell,
  TableRow,
  Checkbox,
  Box,
} from '@mui/material';
import {
  Download,
  Share,
  Delete,
  Favorite,
  FavoriteBorder,
  Upload,
  MoreVert,
} from '@mui/icons-material';
import { ContentAsset } from '../../../hooks/useContentAssets';
import { getStatusChip, formatDate, getModelName } from './utils';
import { AssetPreview } from './AssetPreview';

interface AssetTableRowProps {
  asset: ContentAsset;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onDownload: (asset: ContentAsset) => void;
  onShare: (asset: ContentAsset) => void;
  onDelete: (id: number) => void;
  onFavorite: (id: number) => void;
  onRestore: (asset: ContentAsset) => void;
  onMenuOpen: (id: number, event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: (id: number) => void;
  anchorEl: HTMLElement | null;
  textPreview?: { content: string; loading: boolean; expanded: boolean };
  onToggleTextPreview?: (asset: ContentAsset) => void;
  onCopyId: (id: string) => void;
  onOpenLinkedInAsset?: (asset: ContentAsset) => void;
}

export const AssetTableRow: React.FC<AssetTableRowProps> = ({
  asset,
  isSelected,
  onSelect,
  onDownload,
  onShare,
  onDelete,
  onFavorite,
  onRestore,
  onMenuOpen,
  onMenuClose,
  anchorEl,
  textPreview,
  onToggleTextPreview,
  onCopyId,
  onOpenLinkedInAsset,
}) => {
  return (
    <TableRow
      key={asset.id}
      sx={{
        '&:hover': { background: 'rgba(255,255,255,0.05)' },
        cursor: 'pointer',
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected}
          onChange={e => onSelect(e.target.checked)}
          onClick={e => e.stopPropagation()}
          sx={{ color: 'rgba(255,255,255,0.6)' }}
        />
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{
            color: '#c7d2fe',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' },
          }}
          onClick={() => onCopyId(String(asset.id))}
        >
          {String(asset.id).slice(0, 8)}...
        </Typography>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{
            color: '#f8fafc',
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {getModelName(asset)}
        </Typography>
      </TableCell>
      <TableCell>{getStatusChip(asset.asset_metadata?.status || 'completed')}</TableCell>
      <TableCell>
        <AssetPreview 
          asset={asset} 
          isListView={true} 
          textPreview={textPreview}
          onToggleTextPreview={onToggleTextPreview}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
          {formatDate(asset.created_at)}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Upload">
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              <Upload fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton
              size="small"
              onClick={() => onDownload(asset)}
              sx={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="More">
            <IconButton
              size="small"
              onClick={e => onMenuOpen(asset.id, e)}
              sx={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => onMenuClose(asset.id)}
          >
            {/* Restore Research Project option for research_tools assets */}
            {asset.source_module === 'research_tools' && asset.asset_type === 'text' && asset.asset_metadata?.project_type === 'research_project' && (
              <MenuItem 
                onClick={() => { 
                  onRestore(asset); 
                  onMenuClose(asset.id); 
                }}
                sx={{ color: '#667eea' }}
              >
                <ListItemIcon>
                  <Box sx={{ color: '#667eea', fontSize: 20 }}>🔬</Box>
                </ListItemIcon>
                <ListItemText>Restore in Researcher</ListItemText>
              </MenuItem>
            )}
            {/* Edit in LinkedIn Studio option for linkedin_writer text assets */}
            {asset.source_module === 'linkedin_writer' && asset.asset_type === 'text' && onOpenLinkedInAsset && (
              <MenuItem 
                onClick={() => { 
                  onOpenLinkedInAsset(asset); 
                  onMenuClose(asset.id); 
                }}
                sx={{ color: '#0a66c2' }}
              >
                <ListItemIcon>
                  <Box sx={{ color: '#0a66c2', fontSize: 20 }}>📝</Box>
                </ListItemIcon>
                <ListItemText>Edit in LinkedIn Studio</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={() => { onFavorite(asset.id); onMenuClose(asset.id); }}>
              <ListItemIcon>
                {asset.is_favorite ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{asset.is_favorite ? 'Remove Favorite' : 'Add Favorite'}</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { onShare(asset); onMenuClose(asset.id); }}>
              <ListItemIcon>
                <Share fontSize="small" />
              </ListItemIcon>
              <ListItemText>Share</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                onDelete(asset.id);
                onMenuClose(asset.id);
              }}
              sx={{ color: '#ef4444' }}
            >
              <ListItemIcon>
                <Delete fontSize="small" sx={{ color: '#ef4444' }} />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>
      </TableCell>
    </TableRow>
  );
};
