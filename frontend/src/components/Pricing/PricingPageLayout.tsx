import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import LandingNav from '../Landing/LandingNav';
import LandingFooter from '../Landing/LandingFooter';

const SITE_URL = 'https://www.alwrity.com';
const OG_IMAGE = `${SITE_URL}/Alwrity-copilot1.png`;

interface PricingPageLayoutProps {
  children: React.ReactNode;
}

const PricingPageLayout: React.FC<PricingPageLayoutProps> = ({ children }) => {
  const fullTitle = 'Pricing — ALwrity | Plans for Creators & Marketers';
  const metaDescription =
    'Compare ALwrity Free, Basic, Pro, and Enterprise plans side by side. All AI marketing tools included with transparent monthly limits, cost caps, and annual savings up to 17%.';

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
    setMeta('property', 'og:url', `${SITE_URL}/pricing`);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', OG_IMAGE);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', metaDescription);
    setMeta('name', 'twitter:image', OG_IMAGE);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}/pricing`;
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FFFFFF', color: '#1a1a2e' }}>
      <LandingNav surface="light" />
      <Box component="main" sx={{ pt: { xs: 10, md: 12 }, pb: { xs: 4, md: 6 } }}>
        {children}
      </Box>
      <LandingFooter surface="light" />
    </Box>
  );
};

export default PricingPageLayout;
