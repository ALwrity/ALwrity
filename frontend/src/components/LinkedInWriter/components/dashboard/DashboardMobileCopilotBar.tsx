import React, { useEffect, useState } from 'react';

interface DashboardMobileCopilotBarProps {
  onOpenCopilot: () => void;
}

/**
 * Phase 4 — Full-width sticky Co-Pilot bar for mobile (≤960px).
 * Looks like a chat input; tap opens the existing Co-Pilot sidebar.
 */
export const DashboardMobileCopilotBar: React.FC<DashboardMobileCopilotBarProps> = ({
  onOpenCopilot,
}) => {
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return undefined;

    const viewport = window.visualViewport;
    const syncOffset = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(covered > 40 ? covered : 0);
    };

    syncOffset();
    viewport.addEventListener('resize', syncOffset);
    viewport.addEventListener('scroll', syncOffset);
    return () => {
      viewport.removeEventListener('resize', syncOffset);
      viewport.removeEventListener('scroll', syncOffset);
    };
  }, []);

  return (
    <div
      className="linkedin-mobile-copilot-bar"
      style={{
        bottom: keyboardOffset > 0 ? keyboardOffset : undefined,
      }}
      data-tour="li-mobile-copilot-bar"
    >
      <button
        type="button"
        className="linkedin-mobile-copilot-bar-btn"
        onClick={onOpenCopilot}
        aria-label="Ask ALwrity Co-Pilot"
      >
        <img
          className="linkedin-mobile-copilot-bar-avatar"
          src="/ask-alwrity-girl.png"
          alt=""
          aria-hidden
        />
        <span className="linkedin-mobile-copilot-bar-placeholder">Ask ALwrity Co-Pilot…</span>
        <span className="linkedin-mobile-copilot-bar-cta" aria-hidden>
          Ask
        </span>
      </button>
    </div>
  );
};
