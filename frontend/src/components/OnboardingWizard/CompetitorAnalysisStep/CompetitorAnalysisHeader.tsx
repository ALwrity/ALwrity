import React, { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import {
  onboardingStepHeroGradientPrimarySx,
  onboardingStepHeroGradientSecondarySx,
  onboardingStepHeroSubtitleSx,
  onboardingStepHeroTitleSx,
} from '../common/onboardingStepHeroStyles';
import { RESEARCH_INFO_MODAL_TITLE } from './researchStepInfoConstants';
import { ResearchStepInfoPanel } from './ResearchStepInfoPanel';
import {
  RESEARCH_STEP_HEADER_BOTTOM_MARGIN,
  RESEARCH_STEP_HEADER_TOP_MARGIN,
} from './researchStepSectionStyles';
import { SectionInfoIcon } from '../WebsiteStep/components/SectionInfoIcon';

export const RESEARCH_STEP_SUBTITLE =
  'ALwrity discovers your Competitors, maps their content strategy, and highlights gaps you can own — so the rest of Your setup is built on Real Market Data';

export const CompetitorAnalysisHeader: React.FC = () => {
  const [showHeaderInfo, setShowHeaderInfo] = useState(false);

  return (
    <Box
      data-testid="research-step-header"
      data-top-spacing-xs={RESEARCH_STEP_HEADER_TOP_MARGIN.xs}
      data-top-spacing-md={RESEARCH_STEP_HEADER_TOP_MARGIN.md}
      sx={{ mb: RESEARCH_STEP_HEADER_BOTTOM_MARGIN, mt: RESEARCH_STEP_HEADER_TOP_MARGIN }}
    >
      <Typography
        variant="h4"
        component="h1"
        data-testid="research-step-title-row"
        sx={{
          ...onboardingStepHeroTitleSx,
          mb: 0,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.5,
        }}
      >
        <Box component="span" sx={onboardingStepHeroGradientPrimarySx}>
          Know Your{' '}
        </Box>
        <Box component="span" sx={onboardingStepHeroGradientSecondarySx}>
          Competitive Landscape
        </Box>
        <SectionInfoIcon
          ariaLabel={RESEARCH_INFO_MODAL_TITLE}
          onClick={() => setShowHeaderInfo((prev) => !prev)}
          ariaExpanded={showHeaderInfo}
        />
      </Typography>

      <Typography variant="h6" component="h2" sx={{ ...onboardingStepHeroSubtitleSx, mt: 0.5 }}>
        {RESEARCH_STEP_SUBTITLE}
      </Typography>

      <Collapse in={showHeaderInfo}>
        <ResearchStepInfoPanel onClose={() => setShowHeaderInfo(false)} />
      </Collapse>
    </Box>
  );
};
