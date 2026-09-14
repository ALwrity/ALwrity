import React, { useState } from 'react';
import {
  Typography,
  Box,
  IconButton,
  TextField,
  Tooltip,
  CircularProgress,
  Button,
  InputAdornment,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { researchSectionHeadingSx } from '../../CompetitorAnalysisStep/researchStepSectionStyles';
import { SectionInfoIcon } from './SectionInfoIcon';
import { SocialMediaPlatformPill } from './SocialMediaPlatformPill';
import {
  ALL_SOCIAL_PLATFORMS,
  INACTIVE_SOCIAL_ICON_COLOR,
  SOCIAL_MEDIA_PRESENCE_CAPTION,
  SOCIAL_MEDIA_PRESENCE_INFO_TOOLTIP,
  resolveSocialUrl,
} from './socialMediaPresenceConstants';

interface SocialMediaPresenceSectionProps {
  socialMediaAccounts: { [key: string]: string };
  onUpdateAccounts?: (newAccounts: { [key: string]: string }) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  onRunFreshAnalysis?: () => void;
  isAnalyzing?: boolean;
}

const SocialMediaPresenceSection: React.FC<SocialMediaPresenceSectionProps> = ({
  socialMediaAccounts,
  onUpdateAccounts,
  onRefresh,
  isRefreshing = false,
  onRunFreshAnalysis,
  isAnalyzing = false,
}) => {
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const editingConfig = ALL_SOCIAL_PLATFORMS.find((p) => p.key === editingPlatform);

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
    <Box sx={{ mb: 2, mt: 0 }} data-testid="social-media-presence-section">
      <Box
        display="flex"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        mb={1.5}
        flexWrap="wrap"
        gap={1}
      >
        <Box
          data-testid="social-media-presence-header-row"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, sm: 1 },
            flexWrap: 'nowrap',
            minWidth: 0,
            flex: { xs: '1 1 100%', sm: '1 1 auto' },
          }}
        >
          <Typography variant="h6" sx={{ ...researchSectionHeadingSx, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <ShareIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#667eea !important' }} />
            Social Media Presence
          </Typography>
          <SectionInfoIcon
            tooltip={SOCIAL_MEDIA_PRESENCE_INFO_TOOLTIP}
            ariaLabel="Social media presence information"
          />
          <Typography
            data-testid="social-media-presence-caption"
            variant="caption"
            sx={{
              color: '#64748b',
              fontSize: '0.75rem',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              flex: '1 1 auto',
            }}
          >
            {SOCIAL_MEDIA_PRESENCE_CAPTION}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: { sm: 'auto' } }}>
          {onRefresh && (
            <Tooltip title="Refresh social media data">
              <IconButton
                onClick={onRefresh}
                disabled={isRefreshing}
                size="small"
                sx={{ p: 0.5, opacity: isRefreshing ? 0.6 : 1 }}
                aria-label="Refresh social media data"
              >
                {isRefreshing ? <CircularProgress size={18} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
          )}
          {onRunFreshAnalysis && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={onRunFreshAnalysis}
              disabled={isAnalyzing}
              sx={{
                borderColor: '#667eea',
                color: '#667eea',
                textTransform: 'none',
                whiteSpace: 'nowrap',
                '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' },
              }}
            >
              {isAnalyzing ? 'Analyzing...' : 'Run Fresh Analysis'}
            </Button>
          )}
        </Box>
      </Box>

      {editingPlatform && editingConfig && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', mb: 1 }}>
          <TextField
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            size="small"
            fullWidth
            variant="outlined"
            placeholder="https://..."
            data-testid={`social-edit-field-${editingPlatform}`}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    data-testid={`social-edit-icon-${editingPlatform}`}
                    sx={{
                      color: resolveSocialUrl(editValue) ? editingConfig.color : INACTIVE_SOCIAL_ICON_COLOR,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <editingConfig.Icon sx={{ fontSize: '18px !important' }} />
                  </Box>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.8rem' },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: resolveSocialUrl(editValue) ? editingConfig.color : INACTIVE_SOCIAL_ICON_COLOR,
              },
              bgcolor: 'white',
              flex: 1,
              minWidth: 200,
            }}
            autoFocus
          />
          <IconButton
            size="small"
            onClick={() => handleSaveEdit(editingPlatform)}
            sx={{ color: '#16a34a', p: 0.5 }}
            aria-label={`Save ${editingConfig.label} URL`}
          >
            <CheckIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleCancelEdit}
            sx={{ color: '#dc2626', p: 0.5 }}
            aria-label="Cancel edit"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {ALL_SOCIAL_PLATFORMS.map((platform) => {
          if (editingPlatform === platform.key) {
            return null;
          }

          const rawValue = socialMediaAccounts[platform.key];
          const socialUrl = resolveSocialUrl(rawValue);
          const isConnected = !!socialUrl;

          return (
            <SocialMediaPlatformPill
              key={platform.key}
              platform={platform}
              isConnected={isConnected}
              socialUrl={socialUrl}
              onStartEdit={() => handleStartEdit(platform.key, rawValue || '')}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default SocialMediaPresenceSection;
