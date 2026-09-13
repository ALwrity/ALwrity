import React from 'react';
import { Box, Typography } from '@mui/material';
import { ContentPillarGuidelineCard } from './ContentPillarGuidelineCard';
import { formatBrandPillarTitle } from './contentPillarsConstants';

export interface CompetitorPillarCard {
  website: string;
  company_name: string;
  content_pillars: string[];
}

interface ContentPillarsDashboardGridProps {
  targetCompany: {
    domain: string;
    content_pillars: string[];
  };
  competitors: CompetitorPillarCard[];
  minListHeight: number;
}

const sectionLabelSx = {
  fontWeight: 700,
  color: '#334155',
  textAlign: 'center',
  fontSize: '0.875rem',
  lineHeight: 1.4,
  px: 1,
};

const competitorPillarsLabelSx = {
  ...sectionLabelSx,
  fontSize: '1rem',
};

const desktopGridSx = {
  display: { xs: 'none', md: 'grid' },
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 2,
  alignItems: 'stretch',
};

export const ContentPillarsDashboardGrid: React.FC<ContentPillarsDashboardGridProps> = ({
  targetCompany,
  competitors,
  minListHeight,
}) => {
  const hasBrandPillars = targetCompany.content_pillars.length > 0;
  const brandDomain = formatBrandPillarTitle(targetCompany.domain);
  const brandStrategyLabel = `Your ${brandDomain} Content Strategy`;
  const firstRowCompetitors = competitors.slice(0, 3);
  const secondRowCompetitors = competitors.slice(3, 5);

  const renderCompetitorCard = (comp: CompetitorPillarCard, index: number) => (
    <ContentPillarGuidelineCard
      key={`${comp.company_name}-${index}`}
      title={comp.company_name}
      items={comp.content_pillars}
      variant="competitor"
      minListHeight={minListHeight}
    />
  );

  return (
    <Box data-testid="content-pillars-dashboard-grid" sx={{ mt: { xs: 0.5, md: 1 } }}>
      <Box
        data-testid="content-pillars-mobile-grid"
        sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}
      >
        {hasBrandPillars && (
          <>
            <Typography sx={sectionLabelSx} data-testid="brand-strategy-label">
              {brandStrategyLabel}
            </Typography>
            <ContentPillarGuidelineCard
              title={brandDomain}
              items={targetCompany.content_pillars}
              variant="brand"
              minListHeight={minListHeight}
            />
          </>
        )}
        {competitors.length > 0 && (
          <>
            <Typography sx={competitorPillarsLabelSx} data-testid="competitor-pillars-label">
              Competitor Pillars ({competitors.length})
            </Typography>
            {competitors.map((comp, index) => renderCompetitorCard(comp, index))}
          </>
        )}
      </Box>

      <Box data-testid="content-pillars-desktop-grid" sx={{ display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ ...desktopGridSx, mb: 2.5 }}>
          {hasBrandPillars ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={sectionLabelSx} data-testid="brand-strategy-label">
                {brandStrategyLabel}
              </Typography>
            </Box>
          ) : (
            <Box />
          )}
          {competitors.length > 0 && (
            <Box
              sx={{
                gridColumn: hasBrandPillars ? 'span 3' : 'span 4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={competitorPillarsLabelSx} data-testid="competitor-pillars-label">
                Competitor Pillars ({competitors.length})
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ ...desktopGridSx, mb: secondRowCompetitors.length > 0 ? 2 : 0 }}>
          {hasBrandPillars ? (
            <Box sx={{ display: 'flex' }}>
              <ContentPillarGuidelineCard
                title={brandDomain}
                items={targetCompany.content_pillars}
                variant="brand"
                minListHeight={minListHeight}
              />
            </Box>
          ) : (
            <Box />
          )}
          {firstRowCompetitors.map((comp, index) => (
            <Box key={`competitor-row1-${index}`} sx={{ display: 'flex' }}>
              {renderCompetitorCard(comp, index)}
            </Box>
          ))}
          {firstRowCompetitors.length < 3 &&
            Array.from({ length: 3 - firstRowCompetitors.length }).map((_, index) => (
              <Box key={`competitor-row1-spacer-${index}`} />
            ))}
        </Box>

        {secondRowCompetitors.length > 0 && (
          <Box sx={desktopGridSx}>
            <Box />
            {secondRowCompetitors.map((comp, index) => (
              <Box key={`competitor-row2-${index}`} sx={{ display: 'flex' }}>
                {renderCompetitorCard(comp, index + 3)}
              </Box>
            ))}
            {secondRowCompetitors.length < 2 &&
              Array.from({ length: 2 - secondRowCompetitors.length }).map((_, index) => (
                <Box key={`competitor-row2-spacer-${index}`} />
              ))}
            <Box />
          </Box>
        )}
      </Box>
    </Box>
  );
};
