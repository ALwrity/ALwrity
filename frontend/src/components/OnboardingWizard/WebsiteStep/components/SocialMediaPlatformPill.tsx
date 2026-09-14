import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { SocialPlatformConfig } from './socialMediaPresenceConstants';
import { INACTIVE_SOCIAL_ICON_COLOR, getPlatformTooltip } from './socialMediaPresenceConstants';

/** Expanded action strip width: visit + edit for connected pills, edit-only otherwise. */
export const PILL_ACTION_EXPANDED_WIDTH = {
  connected: 64,
  disconnected: 28,
} as const;

export const PILL_ACTION_ICON_GAP = 0.75;

interface SocialMediaPlatformPillProps {
  platform: SocialPlatformConfig;
  isConnected: boolean;
  socialUrl: string | null;
  onStartEdit: () => void;
}

export const SocialMediaPlatformPill: React.FC<SocialMediaPlatformPillProps> = ({
  platform,
  isConnected,
  socialUrl,
  onStartEdit,
}) => {
  const tooltipTitle = getPlatformTooltip(platform.label, isConnected, socialUrl);
  const expandedWidth = isConnected
    ? PILL_ACTION_EXPANDED_WIDTH.connected
    : PILL_ACTION_EXPANDED_WIDTH.disconnected;

  return (
    <Tooltip
      title={tooltipTitle}
      slotProps={{
        tooltip: {
          sx: {
            whiteSpace: 'nowrap',
            maxWidth: 'none',
          },
        },
      }}
    >
      <Box
        data-testid={`social-pill-${platform.key}`}
        data-connected={isConnected ? 'true' : 'false'}
        onClick={() => !isConnected && onStartEdit()}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0,
          px: 0.75,
          py: 0.5,
          borderRadius: 1,
          cursor: isConnected ? 'default' : 'pointer',
          border: isConnected ? `1px solid ${platform.color}40` : '1px dashed #cbd5e1',
          bgcolor: isConnected ? `${platform.color}08` : '#f8fafc',
          transition: 'all 0.2s ease',
          minHeight: 32,
          overflow: 'hidden',
          '&:hover, &:focus-within': {
            gap: 0.25,
            px: 1,
            borderColor: isConnected ? platform.color : '#94a3b8',
            bgcolor: isConnected ? `${platform.color}12` : '#f1f5f9',
          },
          '&:hover .pill-action-btn, &:focus-within .pill-action-btn': {
            width: expandedWidth,
            minWidth: expandedWidth,
            opacity: 1,
            ml: 0.25,
          },
        }}
      >
        <Box
          sx={{
            color: isConnected ? platform.color : INACTIVE_SOCIAL_ICON_COLOR,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <platform.Icon sx={{ fontSize: '18px !important' }} />
        </Box>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: isConnected ? '#22c55e' : '#ef4444',
            flexShrink: 0,
            mx: 0.25,
          }}
        />
        <Box
          className="pill-action-btn"
          data-testid={`social-pill-actions-${platform.key}`}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: PILL_ACTION_ICON_GAP,
            width: 0,
            minWidth: 0,
            opacity: 0,
            overflow: 'hidden',
            flexShrink: 0,
            transition: 'width 0.2s ease, opacity 0.2s ease, margin 0.2s ease',
          }}
        >
          {isConnected && socialUrl && (
            <IconButton
              component="a"
              href={socialUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open ${platform.label}`}
              data-testid={`social-pill-visit-${platform.key}`}
              sx={{
                p: 0.25,
                flexShrink: 0,
                color: '#64748b',
                '&:hover': { color: platform.color },
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartEdit();
            }}
            aria-label={`Edit ${platform.label} URL`}
            data-testid={`social-pill-edit-${platform.key}`}
            sx={{
              p: 0.25,
              flexShrink: 0,
              color: '#64748b',
              '&:hover': { color: platform.color },
            }}
          >
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>
    </Tooltip>
  );
};
