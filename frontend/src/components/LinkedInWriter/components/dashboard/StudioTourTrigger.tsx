import React, { useEffect, useState } from 'react';

const TOUR_FLOATING_HINT_KEY = 'linkedin_studio_tour_floating_hint_seen';

interface StudioTourTriggerProps {
  /** Compact circle for mobile header nav (after GIF). */
  variant?: 'toolbar' | 'headerNav';
}

export const StudioTourTrigger: React.FC<StudioTourTriggerProps> = ({ variant = 'toolbar' }) => {
  const [showFloatingHint, setShowFloatingHint] = useState(false);
  const isHeaderNav = variant === 'headerNav';

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_FLOATING_HINT_KEY) === '1') return undefined;
    } catch {
      return undefined;
    }

    setShowFloatingHint(true);
    const timer = window.setTimeout(() => {
      setShowFloatingHint(false);
      try {
        localStorage.setItem(TOUR_FLOATING_HINT_KEY, '1');
      } catch {
        // ignore storage errors
      }
    }, 3000);

    return () => window.clearTimeout(timer);
  }, []);

  const handleStartTour = () => {
    if (showFloatingHint) {
      setShowFloatingHint(false);
      try {
        localStorage.setItem(TOUR_FLOATING_HINT_KEY, '1');
      } catch {
        // ignore storage errors
      }
    }
    window.dispatchEvent(new CustomEvent('linkedinwriter:startStudioTour'));
  };

  return (
    <div
      className={`linkedin-studio-tour-trigger-wrap${
        isHeaderNav ? ' linkedin-studio-tour-trigger-wrap--header-nav' : ''
      }`}
    >
      {showFloatingHint && (
        <span className="linkedin-studio-tour-floating-hint" role="status">
          Tour guide
        </span>
      )}
      <button
        type="button"
        className={[
          'linkedin-studio-tour-trigger',
          'linkedin-studio-tour-trigger--icon-only',
          'linkedin-studio-tour-trigger--tooltip',
          isHeaderNav && 'linkedin-studio-tour-trigger--header-nav',
        ]
          .filter(Boolean)
          .join(' ')}
        data-tour="li-tour-trigger"
        onClick={handleStartTour}
        aria-label="Tour guide"
      >
        <span className="linkedin-studio-tour-trigger-icon" aria-hidden>
          ?
        </span>
      </button>
    </div>
  );
};
