import React, { useState } from 'react';
import { Box, Typography, Button, Tooltip, IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import {
  ONBOARDING_STEP_HERO_TOP_MARGIN,
  onboardingStepHeroGradientPrimarySx,
  onboardingStepHeroGradientSecondarySx,
  onboardingStepHeroSubtitleSx,
  onboardingStepHeroTitleSx,
} from '../common/onboardingStepHeroStyles';
import { ResearchStepInfoModal, RESEARCH_INFO_MODAL_TITLE } from './ResearchStepInfoModal';

export const RESEARCH_STEP_SUBTITLE =
  'ALwrity discovers your competitors, maps their content strategy, and highlights gaps you can own — so the rest of your setup is built on real market data.';

interface CompetitorAnalysisHeaderProps {
  isAnalyzing: boolean;
  onRunFreshAnalysis: () => void;
  onOpenBackgroundSetup: () => void;
}

export const CompetitorAnalysisHeader: React.FC<CompetitorAnalysisHeaderProps> = ({
  isAnalyzing,
  onRunFreshAnalysis,
  onOpenBackgroundSetup,
}) => {
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  return (
    <Box
      data-testid="research-step-header"
      data-top-spacing-xs={ONBOARDING_STEP_HERO_TOP_MARGIN.xs}
      data-top-spacing-md={ONBOARDING_STEP_HERO_TOP_MARGIN.md}
      sx={{ mb: 3, mt: ONBOARDING_STEP_HERO_TOP_MARGIN }}
    >
      <Box
        data-testid="research-step-title-row"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 1.25 },
          rowGap: 1,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            ...onboardingStepHeroTitleSx,
            mb: 0,
            flex: { xs: '1 1 100%', sm: '1 1 auto' },
            minWidth: 0,
          }}
        >
          <Box component="span" sx={onboardingStepHeroGradientPrimarySx}>
            Know Your{' '}
          </Box>
          <Box component="span" sx={onboardingStepHeroGradientSecondarySx}>
            Competitive Landscape
          </Box>
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: { xs: 0.75, sm: 1 },
            flexShrink: 0,
            ml: { xs: 0, sm: 'auto' },
          }}
        >
          <Tooltip title={RESEARCH_INFO_MODAL_TITLE}>
            <IconButton
              size="small"
              onClick={() => setInfoModalOpen(true)}
              aria-label={RESEARCH_INFO_MODAL_TITLE}
              sx={{ color: '#64748b' }}
            >
              <InfoIcon />
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
      </Box>

      <Typography variant="h6" component="h2" sx={{ ...onboardingStepHeroSubtitleSx, mt: 1 }}>
        {RESEARCH_STEP_SUBTITLE}
      </Typography>

      <ResearchStepInfoModal open={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
    </Box>
  );
};
