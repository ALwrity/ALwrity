import React from 'react';

import { Link as RouterLink } from 'react-router-dom';

import {
  Box,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';

import BrandMark from './BrandMark';

interface LandingFooterProps {
  surface?: 'dark' | 'light';
}

const FOOTER_LINKS = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Code of Conduct', to: '/code-of-conduct' },
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Contact', to: '/contact' },
] as const;

const LandingFooter: React.FC<LandingFooterProps> = ({ surface = 'dark' }) => {
  const theme = useTheme();
  const year = new Date().getFullYear();
  const isLight = surface === 'light';

  const linkSx = isLight
    ? {
        color: '#64748b',
        textDecoration: 'none',
        fontSize: '0.9rem',
        '&:hover': { color: '#6366f1' },
      }
    : {
        color: alpha('#fff', 0.75),
        textDecoration: 'none',
        fontSize: '0.9rem',
        '&:hover': { color: theme.palette.primary.light },
      };

  const mutedText = isLight ? '#64748b' : alpha('#fff', 0.45);
  const footerLinkMuted = isLight ? '#475569' : alpha('#fff', 0.55);

  return (
    <Box
      component="footer"
      sx={{
        py: 6,
        background: isLight
          ? '#F8FAFC'
          : `linear-gradient(180deg, ${alpha('#0a0a0a', 0.95)} 0%, #000 100%)`,
        borderTop: isLight
          ? '1px solid #E5E7EB'
          : `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={3}
        >
          <BrandMark
            showSubtitle
            showTagline
            logoSize={40}
            variant={isLight ? 'dark' : 'light'}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 3 }} flexWrap="wrap">
            {FOOTER_LINKS.map(({ label, to }) => (
              <Link key={to} component={RouterLink} to={to} sx={linkSx}>
                {label}
              </Link>
            ))}
          </Stack>
        </Stack>

        <Divider
          sx={{
            my: 3,
            borderColor: isLight ? '#E5E7EB' : alpha('#fff', 0.08),
          }}
        />

        <Typography
          variant="caption"
          sx={{ color: mutedText }}
          display="block"
          textAlign="center"
        >
          © {year} ALwrity. Open-source &amp; community-driven. See our{' '}
          {FOOTER_LINKS.map(({ label, to }, index) => (
            <React.Fragment key={to}>
              {index > 0 && (index === FOOTER_LINKS.length - 1 ? ', and ' : ', ')}
              <Link component={RouterLink} to={to} sx={{ color: footerLinkMuted }}>
                {label}
              </Link>
            </React.Fragment>
          ))}
          . Inquiries:{' '}
          <Link href="mailto:info@alwrity.com" sx={{ color: footerLinkMuted }}>
            info@alwrity.com
          </Link>
        </Typography>
      </Container>
    </Box>
  );
};

export default LandingFooter;
