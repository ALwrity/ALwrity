import React from 'react';
import { Box, Button, CircularProgress, Popover, TextField, useMediaQuery } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  analyzeButtonSx,
  analyzeNewWebsiteButtonSx,
  hoverCompactAnalyzeNewWebsiteButtonSx,
  hoverCompactReAnalyzeButtonSx,
  reAnalyzeButtonSx,
  urlFieldSx,
} from './websiteUrlActionBarStyles';
import { RE_ANALYZE_BUTTON_GRADIENT } from '../../common/onboardingButtonStyles';

export interface WebsiteUrlActionBarProps {
  website: string;
  setWebsite: (url: string) => void;
  loading: boolean;
  hasAnalysis: boolean;
  onAnalyze: () => void;
  onAnalyzeNewWebsite: () => void;
  variant?: 'default' | 'compact';
}

const WebsiteUrlActionBar: React.FC<WebsiteUrlActionBarProps> = ({
  website,
  setWebsite,
  loading,
  hasAnalysis,
  onAnalyze,
  onAnalyzeNewWebsite,
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';
  const showSecondaryAction = hasAnalysis && !loading;
  const primaryButtonSx = hasAnalysis
    ? isCompact
      ? hoverCompactReAnalyzeButtonSx
      : reAnalyzeButtonSx
    : analyzeButtonSx;
  const secondaryButtonSx = isCompact
    ? hoverCompactAnalyzeNewWebsiteButtonSx
    : analyzeNewWebsiteButtonSx;

  return (
    <Box
      data-testid="website-url-action-bar"
      data-variant={variant}
      sx={{ position: 'relative', mb: isCompact ? 0 : 2, width: '100%' }}
    >
      <Box sx={{ position: 'relative', width: '100%' }}>
        <TextField
        label={isCompact ? 'Website URL' : 'Your website URL (e.g., www.example.com)'}
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        fullWidth
        placeholder={
          isCompact
            ? website.replace(/^https?:\/\//i, '') || 'www.example.com'
            : 'Enter your URL to instantly capture your brand voice.'
        }
        disabled={loading}
        size={isCompact ? 'small' : 'medium'}
        InputLabelProps={{ shrink: true }}
        inputProps={
          isCompact
            ? { 'aria-label': 'Analyzed website URL', style: { textOverflow: 'ellipsis' } }
            : undefined
        }
        sx={urlFieldSx(showSecondaryAction, variant)}
        />
        <Box
          sx={{
            position: 'absolute',
            right: isCompact ? 4 : 6,
            top: isCompact ? 4 : 6,
            bottom: isCompact ? 4 : 6,
            display: 'flex',
            alignItems: 'center',
            gap: isCompact ? 0.4 : 0.75,
            zIndex: 1,
          }}
        >
        <Button
          variant="contained"
          onClick={onAnalyze}
          disabled={!website || loading}
          data-testid={hasAnalysis ? 're-analyze-button' : 'analyze-button'}
          data-button-gradient={hasAnalysis ? RE_ANALYZE_BUTTON_GRADIENT : undefined}
          startIcon={
            loading ? (
              <CircularProgress size={isCompact ? 12 : 18} color="inherit" />
            ) : hasAnalysis ? (
              <RefreshIcon sx={{ fontSize: isCompact ? 12 : 18 }} />
            ) : (
              <AnalyticsIcon sx={{ fontSize: isCompact ? 12 : 18 }} />
            )
          }
          sx={primaryButtonSx}
        >
          {loading ? 'Analyzing...' : hasAnalysis ? 'Re-Analyze' : 'Analyze'}
        </Button>
        {showSecondaryAction && (
          <Button
            variant="outlined"
            size="small"
            onClick={onAnalyzeNewWebsite}
            sx={secondaryButtonSx}
          >
            Analyze New Website
          </Button>
        )}
        </Box>
      </Box>
    </Box>
  );
};

interface WebsiteTabUrlHoverPanelProps {
  enabled: boolean;
  website: string;
  setWebsite: (url: string) => void;
  loading: boolean;
  onAnalyze: () => void;
  onAnalyzeNewWebsite: () => void;
  children: React.ReactNode;
}

export const WebsiteTabUrlHoverPanel: React.FC<WebsiteTabUrlHoverPanelProps> = ({
  enabled,
  website,
  setWebsite,
  loading,
  onAnalyze,
  onAnalyzeNewWebsite,
  children,
}) => {
  const isTouch = useMediaQuery('(hover: none)');
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const closeTimerRef = React.useRef<number | null>(null);
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setAnchorEl(null), 180);
  };

  const handleOpen = () => {
    if (anchorRef.current) {
      clearCloseTimer();
      setAnchorEl(anchorRef.current);
    }
  };

  React.useEffect(() => () => clearCloseTimer(), []);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <>
      <Box
        component="span"
        ref={anchorRef}
        onMouseEnter={() => {
          if (!isTouch) handleOpen();
        }}
        onMouseLeave={() => {
          if (!isTouch) scheduleClose();
        }}
        onClick={() => {
          if (isTouch) {
            setAnchorEl((prev) => (prev ? null : anchorRef.current));
          }
        }}
        sx={{ display: 'flex', minWidth: 0, width: '100%' }}
      >
        {children}
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        disableRestoreFocus
        slotProps={{
          backdrop: { invisible: true },
          paper: {
            'data-testid': 'website-tab-url-popover',
            onMouseEnter: clearCloseTimer,
            onMouseLeave: scheduleClose,
            sx: {
              pointerEvents: 'auto',
              p: { xs: 1, sm: 1.25 },
              mt: 0.75,
              borderRadius: 2,
              bgcolor: '#FFFFFF',
              backgroundImage: 'none',
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.1)',
              width: { xs: 'min(calc(100vw - 24px), 680px)', sm: 620, md: 580 },
              maxWidth: 'calc(100vw - 24px)',
            },
          },
        }}
        sx={{ pointerEvents: 'none', zIndex: 1700 }}
      >
        <WebsiteUrlActionBar
          variant="compact"
          website={website}
          setWebsite={setWebsite}
          loading={loading}
          hasAnalysis={true}
          onAnalyze={onAnalyze}
          onAnalyzeNewWebsite={onAnalyzeNewWebsite}
        />
      </Popover>
    </>
  );
};

export default WebsiteUrlActionBar;
