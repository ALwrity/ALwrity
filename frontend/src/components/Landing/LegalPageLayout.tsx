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
import { LANDING_MARKETING_PATH } from '../../utils/landingNavigation';

interface LegalPageLayoutProps {
  title: string;
  metaDescription: string;
  canonicalPath: string;
  /** When false, hides the “Last updated…” subline (e.g. Contact page). Default true. */
  showLastUpdated?: boolean;
  /** Light surface matches Pricing; default dark for legal pages. */
  surface?: 'dark' | 'light';
  /** Override default OG/Twitter image path (filename under public/ or absolute URL). */
  ogImage?: string;
  ogImageAlt?: string;
  children: React.ReactNode;
}

const SITE_URL = 'https://www.alwrity.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-alwrity-landing.png`;

const resolveOgImage = (ogImage?: string) => {
  if (!ogImage) return DEFAULT_OG_IMAGE;
  if (ogImage.startsWith('http')) return ogImage;
  return `${SITE_URL}/${ogImage.replace(/^\//, '')}`;
};

const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  metaDescription,
  canonicalPath,
  showLastUpdated = true,
  surface = 'dark',
  ogImage,
  ogImageAlt,
  children,
}) => {
  const theme = useTheme();
  const fullTitle = `${title} — ALwrity`;
  const isLight = surface === 'light';
  const resolvedOgImage = resolveOgImage(ogImage);
  const resolvedOgImageAlt = ogImageAlt ?? `${title} — ALwrity`;

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
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', resolvedOgImage);
    setMeta('property', 'og:image:alt', resolvedOgImageAlt);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', metaDescription);
    setMeta('name', 'twitter:image', resolvedOgImage);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}${canonicalPath}`;
  }, [fullTitle, metaDescription, canonicalPath, resolvedOgImage, resolvedOgImageAlt]);

  const pageBg = isLight ? '#FFFFFF' : '#0a0a0a';
  const pageColor = isLight ? '#1a1a2e' : '#fff';
  const backLinkColor = isLight ? '#64748b' : alpha('#fff', 0.6);
  const mutedSubline = isLight ? '#64748b' : alpha('#fff', 0.55);
  const bodyText = isLight ? '#374151' : alpha('#fff', 0.82);
  const headingColor = isLight ? '#1a1a2e' : '#fff';
  const linkColor = isLight ? theme.palette.primary.main : theme.palette.primary.light;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: pageBg, color: pageColor }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: 9999,
          px: 2,
          py: 1,
          background: theme.palette.primary.main,
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
          '&:focus-visible': {
            position: 'fixed',
            left: 16,
            top: 16,
            outline: '2px solid #fff',
            outlineOffset: 2,
          },
        }}
      >
        Skip to main content
      </Box>

      <LandingNav surface={surface} />

      <Container
        maxWidth="md"
        component="main"
        id="main-content"
        aria-label={`${title} page content`}
        sx={{ py: { xs: isLight ? 10 : 6, md: isLight ? 12 : 10 } }}
      >
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Link
              component={RouterLink}
              to={LANDING_MARKETING_PATH}
              sx={{
                color: backLinkColor,
                textDecoration: 'none',
                fontSize: '0.9rem',
                '&:hover': { color: linkColor },
              }}
            >
              ← Back to home
            </Link>
            <Typography
              variant="h3"
              component="h1"
              fontWeight={800}
              sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, color: headingColor }}
            >
              {title}
            </Typography>
            {showLastUpdated && (
              <Typography variant="body2" sx={{ color: mutedSubline }}>
                Last updated: June 2025 · Questions?{' '}
                <Link href="mailto:info@alwrity.com" sx={{ color: linkColor }}>
                  info@alwrity.com
                </Link>
              </Typography>
            )}
          </Stack>

          <Box
            sx={{
              '& h2': {
                fontSize: '1.35rem',
                fontWeight: 700,
                mt: 3,
                mb: 1.5,
                color: headingColor,
              },
              '& p, & li': {
                color: bodyText,
                lineHeight: 1.75,
                fontSize: '1rem',
              },
              '& ul': { pl: 3, mb: 2 },
              '& a': { color: linkColor },
            }}
          >
            {children}
          </Box>
        </Stack>
      </Container>
      <LandingFooter surface={surface} />
    </Box>
  );
};

export default LegalPageLayout;
