import React from 'react';
import { Box, Typography, Button, Tooltip, IconButton, Collapse, Grid } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoFixHighIcon from '@mui/icons-material/AutoAwesome';
import { lightTheme } from './competitorStepUiHelpers';

interface CompetitorAnalysisHeaderProps {
  showHeaderInfo: boolean;
  isAnalyzing: boolean;
  onToggleHeaderInfo: () => void;
  onRunFreshAnalysis: () => void;
  onOpenBackgroundSetup: () => void;
}

export const CompetitorAnalysisHeader: React.FC<CompetitorAnalysisHeaderProps> = ({
  showHeaderInfo,
  isAnalyzing,
  onToggleHeaderInfo,
  onRunFreshAnalysis,
  onOpenBackgroundSetup,
}) => (
  <>
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 4 }}>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          background: 'linear-gradient(45deg, #2563EB 30%, #7C3AED 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        Competitive Intelligence
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ flex: 1, minWidth: 200, fontSize: '0.9rem' }}
      >
        — Uncover the strategies that are working for your competitors to build your own advantage.
      </Typography>
      <Tooltip title="About this step">
        <IconButton size="small" onClick={onToggleHeaderInfo} sx={{ color: '#64748b' }}>
          {showHeaderInfo ? <ExpandLessIcon /> : <InfoIcon />}
        </IconButton>
      </Tooltip>
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
      <Button
        size="small"
        variant="outlined"
        onClick={onOpenBackgroundSetup}
        sx={{
          borderColor: '#3b82f6',
          color: '#3b82f6',
          textTransform: 'none',
          whiteSpace: 'nowrap',
          '&:hover': { borderColor: '#2563eb', bgcolor: 'rgba(59,130,246,0.08)' },
        }}
      >
        ⚙️ Smart Background Setup
      </Button>
    </Box>

    <Collapse in={showHeaderInfo}>
      <Box
        sx={{
          mb: 3,
          p: 3,
          bgcolor: lightTheme.surface,
          color: lightTheme.text,
          borderRadius: 3,
          border: `1px solid ${lightTheme.border}`,
          boxShadow: lightTheme.shadowSm,
          maxWidth: 800,
          textAlign: 'left',
        }}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box sx={{ p: 1.5, bgcolor: '#DBEAFE', borderRadius: '50%', mb: 1.5, color: '#2563EB' }}>
                <SearchIcon />
              </Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                What
              </Typography>
              <Typography variant="caption" color="text.secondary">
                We analyze top competitors in your niche.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box sx={{ p: 1.5, bgcolor: '#F3E8FF', borderRadius: '50%', mb: 1.5, color: '#7C3AED' }}>
                <TrendingUpIcon />
              </Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Why
              </Typography>
              <Typography variant="caption" color="text.secondary">
                To identify content gaps and market positioning.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box sx={{ p: 1.5, bgcolor: '#DCFCE7', borderRadius: '50%', mb: 1.5, color: '#16A34A' }}>
                <AutoFixHighIcon />
              </Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                How
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Using AI to scan their public content and social footprint.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Collapse>
  </>
);
