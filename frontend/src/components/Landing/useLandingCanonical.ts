import { useEffect } from 'react';

const SITE_URL = 'https://www.alwrity.com';
const LANDING_CANONICAL = `${SITE_URL}/`;

/** TC 035 — both `/` and `/home` declare canonical as `/`. */
export function useLandingCanonical(): void {
  useEffect(() => {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = LANDING_CANONICAL;
  }, []);
}
