import { useEffect, useState } from 'react';

import { DESKTOP_DASHBOARD_MIN_WIDTH_PX } from '../components/dashboard/dashboardLayoutConstants';

const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_DASHBOARD_MIN_WIDTH_PX}px)`;

/** True when the viewport is wide-screen desktop (LinkedIn Studio dashboard layout). */
export function useDesktopViewport(): boolean {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return desktop;
}
