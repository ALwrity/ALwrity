import React, { useState } from 'react';
import { Box, Typography, Button, Tooltip, IconButton, Collapse } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {
  ONBOARDING_STEP_HERO_TOP_MARGIN,
  onboardingStepHeroGradientPrimarySx,
  onboardingStepHeroGradientSecondarySx,
  onboardingStepHeroSubtitleSx,
  onboardingStepHeroTitleSx,
} from '../common/onboardingStepHeroStyles';
import { RESEARCH_INFO_MODAL_TITLE } from './researchStepInfoConstants';
import { ResearchStepInfoPanel } from './ResearchStepInfoPanel';

export const RESEARCH_STEP_SUBTITLE =
  'ALwrity discovers your competitors, maps their content strategy, and highlights gaps you can own — so the rest of your setup is built on real market data.';

interface CompetitorAnalysisHeaderProps {
  isAnalyzing: boolean;
  onRunFreshAnalysis: () => void;
}

export const CompetitorAnalysisHeader: React.FC<CompetitorAnalysisHeaderProps> = ({
  isAnalyzing,
  onRunFreshAnalysis,
}) => {
  const [showHeaderInfo, setShowHeaderInfo] = useState(false);

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
              onClick={() => setShowHeaderInfo((prev) => !prev)}
              aria-label={RESEARCH_INFO_MODAL_TITLE}
              aria-expanded={showHeaderInfo}
              sx={{ color: '#64748b' }}
            >
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
        </Box>
      </Box>

      <Typography variant="h6" component="h2" sx={{ ...onboardingStepHeroSubtitleSx, mt: 1 }}>
        {RESEARCH_STEP_SUBTITLE}
      </Typography>

      <Collapse in={showHeaderInfo}>
        <ResearchStepInfoPanel />
      </Collapse>
    </Box>
  );
};
