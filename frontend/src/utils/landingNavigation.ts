export type LandingSectionId = 'hero' | 'lifecycle' | 'features';

/** Public marketing landing route — always shows Landing (signed-in or not). */
export const LANDING_MARKETING_PATH = '/home';

const NAV_OFFSET_PX = 72;

export function isLandingMarketingPath(pathname: string): boolean {
  return pathname === '/' || pathname === LANDING_MARKETING_PATH;
}

export function landingPathForSection(section: LandingSectionId): string {
  return section === 'hero' ? LANDING_MARKETING_PATH : `${LANDING_MARKETING_PATH}#${section}`;
}

export function scrollToLandingSection(section: LandingSectionId): boolean {
  if (section === 'hero') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }

  const el = document.getElementById(section);
  if (!el) return false;

  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  return true;
}

/** Retry scroll for lazy-loaded landing sections (e.g. features). */
export function scrollToLandingSectionWithRetry(
  section: LandingSectionId,
  maxAttempts = 30,
  intervalMs = 200
): () => void {
  if (section === 'hero') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => undefined;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    if (scrollToLandingSection(section) || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
    attempts += 1;
  }, intervalMs);

  return () => window.clearInterval(timer);
}

export function parseLandingHash(hash: string): LandingSectionId | null {
  const id = hash.replace('#', '').trim();
  if (id === 'hero' || id === 'lifecycle' || id === 'features') {
    return id;
  }
  return null;
}
