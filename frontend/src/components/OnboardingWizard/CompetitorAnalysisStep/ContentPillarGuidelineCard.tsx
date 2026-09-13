import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  CONTENT_PILLAR_BRAND_PILL_BORDER,
  CONTENT_PILLAR_COMPETITOR_PILL_BORDER,
} from './contentPillarsConstants';

export type ContentPillarCardVariant = 'brand' | 'competitor';

interface ContentPillarGuidelineCardProps {
  title: string;
  items: string[];
  variant: ContentPillarCardVariant;
  minListHeight: number;
}

const pillStyles: Record<ContentPillarCardVariant, { border: string; bgcolor: string }> = {
  brand: {
    border: `2px solid ${CONTENT_PILLAR_BRAND_PILL_BORDER}`,
    bgcolor: '#ffffff',
  },
  competitor: {
    border: `2px solid ${CONTENT_PILLAR_COMPETITOR_PILL_BORDER}`,
    bgcolor: '#ffffff',
  },
};

export const ContentPillarGuidelineCard: React.FC<ContentPillarGuidelineCardProps> = ({
  title,
  items,
  variant,
  minListHeight,
}) => {
  const pill = pillStyles[variant];

  return (
    <Box
      data-testid="content-pillar-guideline-card"
      data-pillar-variant={variant}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        width: '100%',
      }}
    >
      <Box
        data-testid="content-pillar-pill"
        sx={{
          bgcolor: pill.bgcolor,
          border: pill.border,
          borderRadius: 999,
          px: 2.5,
          py: 0.75,
          mb: -1.25,
          zIndex: 1,
          position: 'relative',
          maxWidth: '100%',
        }}
      >
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ color: '#1e293b', lineHeight: 1.35, textAlign: 'center' }}
          noWrap
        >
          {title}
        </Typography>
      </Box>
      <Box
        data-testid="content-pillar-list-card"
        data-min-list-height={minListHeight}
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #E2E8F0',
          borderRadius: 3,
          p: 2,
          pt: 2.25,
          width: '100%',
          flex: 1,
          minHeight: minListHeight,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
        }}
      >
        <Box component="ul" sx={{ m: 0, pl: 2.25, flex: 1 }}>
          {items.map((item, index) => (
            <Typography
              component="li"
              variant="body2"
              key={`${title}-${index}`}
              sx={{
                color: '#475569',
                mb: 0.75,
                lineHeight: 1.45,
                fontSize: '0.8125rem',
              }}
            >
              {item}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
};
