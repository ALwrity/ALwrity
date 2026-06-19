import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Link,
  Stack,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import LandingNav from './LandingNav';
import LandingFooter from './LandingFooter';

interface LegalPageLayoutProps {
  title: string;
  metaDescription: string;
  canonicalPath: string;
  children: React.ReactNode;
}

const SITE_URL = 'https://www.alwrity.com';

const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  metaDescription,
  canonicalPath,
  children,
}) => {
  const theme = useTheme();
  const fullTitle = `${title} — ALwrity`;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', metaDescription);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', metaDescription);
    setMeta('property', 'og:url', `${SITE_URL}${canonicalPath}`);
    setMeta('property', 'og:image', `${SITE_URL}/og-alwrity-landing.png`);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', metaDescription);
    setMeta('name', 'twitter:image', `${SITE_URL}/og-alwrity-landing.png`);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}${canonicalPath}`;
  }, [fullTitle, metaDescription, canonicalPath]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff' }}>
      <LandingNav />
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Link
              component={RouterLink}
              to="/"
              sx={{
                color: alpha('#fff', 0.6),
                textDecoration: 'none',
                fontSize: '0.9rem',
                '&:hover': { color: theme.palette.primary.light },
              }}
            >
              ← Back to home
            </Link>
            <Typography
              variant="h3"
              component="h1"
              fontWeight={800}
              sx={{ fontSize: { xs: '2rem', md: '2.75rem' } }}
            >
              {title}
            </Typography>
            <Typography variant="body2" color={alpha('#fff', 0.55)}>
              Last updated: June 2025 · Questions?{' '}
              <Link href="mailto:info@alwrity.com" sx={{ color: theme.palette.primary.light }}>
                info@alwrity.com
              </Link>
            </Typography>
          </Stack>

          <Box
            sx={{
              '& h2': {
                fontSize: '1.35rem',
                fontWeight: 700,
                mt: 3,
                mb: 1.5,
                color: '#fff',
              },
              '& p, & li': {
                color: alpha('#fff', 0.82),
                lineHeight: 1.75,
                fontSize: '1rem',
              },
              '& ul': { pl: 3, mb: 2 },
              '& a': { color: theme.palette.primary.light },
            }}
          >
            {children}
          </Box>
        </Stack>
      </Container>
      <LandingFooter />
    </Box>
  );
};

export default LegalPageLayout;
