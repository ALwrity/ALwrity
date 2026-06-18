import React, { useState } from 'react';
import {
  Typography,
  Box,
  IconButton,
  TextField,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Share as ShareIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  YouTube as YouTubeIcon,
  Twitter as TwitterIcon,
  MusicNote as MusicNoteIcon,
  Pinterest as PinterestIcon,
  GitHub as GitHubIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';

interface SocialMediaPresenceSectionProps {
  socialMediaAccounts: { [key: string]: string };
  onUpdateAccounts?: (newAccounts: { [key: string]: string }) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

const ALL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', icon: <FacebookIcon />, color: '#1877F2' },
  { key: 'twitter', label: 'X', icon: <TwitterIcon />, color: '#1DA1F2' },
  { key: 'instagram', label: 'Instagram', icon: <InstagramIcon />, color: '#E4405F' },
  { key: 'linkedin', label: 'LinkedIn', icon: <LinkedInIcon />, color: '#0A66C2' },
  { key: 'youtube', label: 'YouTube', icon: <YouTubeIcon />, color: '#FF0000' },
  { key: 'tiktok', label: 'TikTok', icon: <MusicNoteIcon />, color: '#000000' },
  { key: 'pinterest', label: 'Pinterest', icon: <PinterestIcon />, color: '#BD081C' },
  { key: 'github', label: 'GitHub', icon: <GitHubIcon />, color: '#333333' },
];

const resolveSocialUrl = (value: any): string | null => {
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.includes('.')) return `https://${value}`;
  }
  return null;
};

const SocialMediaPresenceSection: React.FC<SocialMediaPresenceSectionProps> = ({
  socialMediaAccounts,
  onUpdateAccounts,
  onRefresh,
  isRefreshing = false
}) => {
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (platform: string, url: string) => {
    setEditingPlatform(platform);
    setEditValue(url);
  };

  const handleSaveEdit = (platform: string) => {
    if (onUpdateAccounts) {
      const newAccounts = { ...socialMediaAccounts, [platform]: editValue };
      onUpdateAccounts(newAccounts);
    }
    setEditingPlatform(null);
  };

  const handleCancelEdit = () => {
    setEditingPlatform(null);
    setEditValue('');
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#1a202c !important', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
            <ShareIcon sx={{ mr: 0.75, verticalAlign: 'middle', color: '#667eea !important', fontSize: 18 }} />
            Social Media Presence
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.3 }}>
            Verify and fill in any missing social media URLs
          </Typography>
        </Box>
        {onRefresh && (
            <Tooltip title="Refresh social media data">
                <IconButton onClick={onRefresh} disabled={isRefreshing} size="small" sx={{ p: 0.5, opacity: isRefreshing ? 0.6 : 1 }}>
                    {isRefreshing ? <CircularProgress size={18} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
                </IconButton>
            </Tooltip>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {ALL_PLATFORMS.map((platform) => {
          const rawValue = socialMediaAccounts[platform.key];
          const socialUrl = resolveSocialUrl(rawValue);
          const isConnected = !!socialUrl;
          const isEditing = editingPlatform === platform.key;

          if (isEditing) {
            return (
              <Box key={platform.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', mb: 0.5 }}>
                <TextField
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size="small"
                  fullWidth
                  variant="outlined"
                  placeholder="https://..."
                  sx={{
                    '& .MuiInputBase-input': { py: 0.25, px: 1, fontSize: '0.8rem' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: platform.color },
                    bgcolor: 'white',
                    flex: 1,
                    minWidth: 200
                  }}
                  autoFocus
                />
                <IconButton size="small" onClick={() => handleSaveEdit(platform.key)} sx={{ color: '#16a34a', p: 0.5 }}>
                  <CheckIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" onClick={handleCancelEdit} sx={{ color: '#dc2626', p: 0.5 }}>
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            );
          }

          return (
            <Tooltip key={platform.key} title={isConnected ? socialUrl! : 'Click to add URL'}>
              <Box
                onClick={() => !isConnected && handleStartEdit(platform.key, '')}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  cursor: isConnected ? 'default' : 'pointer',
                  border: isConnected ? `1px solid` : '1px dashed',
                  borderColor: isConnected ? `${platform.color}60` : '#fca5a5',
                  bgcolor: isConnected ? `${platform.color}0d` : '#fff5f5',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  '&:hover .edit-overlay': { opacity: 1 },
                  '&:hover': isConnected ? { borderColor: platform.color, bgcolor: `${platform.color}15` } : { borderColor: '#ef4444', bgcolor: '#fef2f2' },
                  minHeight: 28
                }}
              >
                <Box sx={{ color: isConnected ? platform.color : '#fca5a5', display: 'flex', alignItems: 'center', '& > svg': { fontSize: '16px !important' } }}>
                  {platform.icon}
                </Box>
                <Typography variant="caption" sx={{
                  fontWeight: 600,
                  color: isConnected ? '#1e293b' : '#dc2626',
                  fontSize: '0.75rem',
                  lineHeight: 1,
                  mr: 0.25
                }}>
                  {platform.label}
                </Typography>
                <Box sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: isConnected ? '#22c55e' : '#ef4444',
                  flexShrink: 0,
                  ml: 0.25
                }} />
                {isConnected && (
                  <IconButton
                    component="a"
                    href={socialUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="edit-overlay"
                    size="small"
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      p: 0.25,
                      bgcolor: 'rgba(255,255,255,0.9)',
                      borderRadius: '0 4px 4px 0',
                      color: '#64748b',
                      '&:hover': { color: platform.color }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
                <IconButton
                  className="edit-overlay"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleStartEdit(platform.key, rawValue || '');
                  }}
                  sx={{
                    position: 'absolute',
                    right: isConnected ? 18 : 0,
                    top: 0,
                    bottom: 0,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    p: 0.25,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    borderRadius: isConnected ? 0 : '0 4px 4px 0',
                    color: '#64748b',
                    '&:hover': { color: platform.color }
                  }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export default SocialMediaPresenceSection;
