import { useEffect } from 'react';

const KEYBOARD_INSET_CSS_VAR = '--li-visual-viewport-keyboard-inset';
const KEYBOARD_THRESHOLD_PX = 40;

/**
 * Mobile (≤960px): sync keyboard overlap from visualViewport to a CSS custom property
 * so Co-Pilot sidebar input and FAB stay above the on-screen keyboard.
 */
export function useMobileVisualViewportInset(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const syncInset = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const inset = covered > KEYBOARD_THRESHOLD_PX ? covered : 0;
      document.body.style.setProperty(KEYBOARD_INSET_CSS_VAR, `${inset}px`);
    };

    syncInset();
    viewport.addEventListener('resize', syncInset);
    viewport.addEventListener('scroll', syncInset);
    window.addEventListener('orientationchange', syncInset);

    return () => {
      viewport.removeEventListener('resize', syncInset);
      viewport.removeEventListener('scroll', syncInset);
      window.removeEventListener('orientationchange', syncInset);
      document.body.style.removeProperty(KEYBOARD_INSET_CSS_VAR);
    };
  }, [enabled]);
}
