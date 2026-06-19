import React from 'react';
import { Box, Stack, Typography, alpha } from '@mui/material';

interface BrandMarkProps {
  showTagline?: boolean;
  showSubtitle?: boolean;
  logoSize?: number;
  variant?: 'light' | 'dark' | 'nav';
  titleSize?: 'default' | 'nav';
}

const BrandMark: React.FC<BrandMarkProps> = ({
  showTagline = true,
  showSubtitle = false,
  logoSize = 36,
  variant = 'light',
  titleSize = 'default',
}) => {
  const isLight = variant === 'light' || variant === 'nav';
  const titleColor = isLight ? '#fff' : '#111';
  const subColor = isLight ? alpha('#fff', 0.65) : alpha('#111', 0.6);
  const tagColor = isLight ? alpha('#fff', 0.75) : alpha('#111', 0.75);

  const titleFontSize =
    titleSize === 'nav' || variant === 'nav'
      ? { xs: '1.35rem', md: '1.55rem' }
      : { xs: '1rem', md: '1.1rem' };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        component="img"
        src="/og-alwrity-landing.png"
        alt="ALwrity Marketing Operating System"
        sx={{ width: logoSize, height: logoSize, objectFit: 'contain', display: 'block' }}
      />
      <Stack spacing={0.1} sx={{ pt: variant === 'nav' ? 0 : undefined }}>
        <Typography
          variant="subtitle1"
          fontWeight={800}
          sx={{
            color: titleColor,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            fontSize: titleFontSize,
          }}
        >
          ALwrity
        </Typography>
        {showSubtitle && (
          <Typography variant="caption" sx={{ color: subColor, lineHeight: 1.2, fontSize: '0.65rem' }}>
            Alwrity Marketing Operating System
          </Typography>
        )}
        {showTagline && (
          <Typography
            variant="caption"
            sx={{ color: tagColor, fontStyle: 'italic', fontSize: '0.68rem', lineHeight: 1.15 }}
          >
            Think AI, Ask ALwrity
          </Typography>
        )}
      </Stack>
    </Stack>
  );
};

export default BrandMark;
