import React from 'react';

export type DashboardRailIconId = 'knowledge' | 'library' | 'growth' | 'resume';

interface DashboardRailIconButtonProps {
  label: string;
  icon: DashboardRailIconId;
  onClick: () => void;
  open?: boolean;
  ariaExpanded?: boolean;
  /** Keep label visible (no hover-expand). Used for Growth & Resume. */
  alwaysShowLabel?: boolean;
  /** Icon before label (toolbar pills). Default: label expands left of right-aligned icon. */
  iconLeading?: boolean;
  /** Emoji replaces the SVG icon (e.g. growth 🚀). */
  emojiIcon?: string;
  title?: string;
}

const ICONS: Record<DashboardRailIconId, React.ReactNode> = {
  knowledge: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5A2.5 2.5 0 0 0 6.5 22H18a2 2 0 0 0 2-2v-9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H18v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 6v8M9 8.5h6M9 11.5h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
  library: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5V19Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 4h5.5A1.5 1.5 0 0 1 16 5.5V19H9V4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M16 8.5H20A1.5 1.5 0 0 1 21.5 10V19H16V8.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M6.5 8h1M11.5 8h1M17.5 12h1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  growth: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 16.5c3.5-6 5.5-9 8-9s4.5 3 8 9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.5V4M9.5 5.5 12 4l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 19h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  resume: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11A1.5 1.5 0 0 0 19 19.5V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
};

export const DashboardRailIconButton: React.FC<DashboardRailIconButtonProps> = ({
  label,
  icon,
  onClick,
  open = false,
  ariaExpanded,
  alwaysShowLabel = false,
  iconLeading = false,
  emojiIcon,
  title,
}) => {
  const iconNode = emojiIcon ?? ICONS[icon];

  return (
    <button
      type="button"
      className={[
        'linkedin-rail-icon-trigger',
        `linkedin-rail-icon-trigger--${icon}`,
        open && 'linkedin-rail-icon-trigger--open',
        alwaysShowLabel && 'linkedin-rail-icon-trigger--labeled',
        iconLeading && 'linkedin-rail-icon-trigger--icon-leading',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label={label}
      aria-expanded={ariaExpanded}
      title={title ?? label}
    >
      {iconLeading ? (
        <>
          <span
            className={[
              'linkedin-rail-icon-trigger-icon',
              emojiIcon && 'linkedin-rail-icon-trigger-icon--emoji',
            ].filter(Boolean).join(' ')}
          >
            {iconNode}
          </span>
          <span className="linkedin-rail-icon-trigger-label">{label}</span>
        </>
      ) : (
        <>
          <span className="linkedin-rail-icon-trigger-label">{label}</span>
          <span className="linkedin-rail-icon-trigger-icon">{ICONS[icon]}</span>
        </>
      )}
    </button>
  );
};
