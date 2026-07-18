import { useEffect, useState } from 'react';
import { HEADER_COMPACT_MAX_WIDTH_PX } from '../components/dashboard/dashboardLayoutConstants';

/** True when LinkedIn Writer uses compact mobile header layout (≤768px). */
export function useMobileHeaderNav(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${HEADER_COMPACT_MAX_WIDTH_PX}px)`).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(`(max-width: ${HEADER_COMPACT_MAX_WIDTH_PX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return isMobile;
}
