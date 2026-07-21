import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null
  );
}

/** Phase 6 — trap Tab within a modal and restore focus on close. */
export function useModalFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void
): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const root = containerRef.current;
    const previousActive = document.activeElement as HTMLElement | null;

    const focusInitial = () => {
      const focusable = getFocusableElements(root);
      const closeBtn = root.querySelector<HTMLElement>(
        '.linkedin-profile-optimization-dialog__close'
      );
      (closeBtn && focusable.includes(closeBtn) ? closeBtn : focusable[0])?.focus();
    };

    const raf = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(root);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      root.removeEventListener('keydown', onKeyDown);
      previousActive?.focus?.();
    };
  }, [active, containerRef, onEscape]);
}
