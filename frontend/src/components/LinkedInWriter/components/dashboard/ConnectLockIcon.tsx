import React from 'react';

interface ConnectLockIconProps {
  size?: number;
  className?: string;
}

/** Grey lock glyph for connect-gated LinkedIn Studio controls. */
export const ConnectLockIcon: React.FC<ConnectLockIconProps> = ({
  size = 12,
  className,
}) => (
  <svg
    className={['linkedin-studio-connect-lock-icon', className].filter(Boolean).join(' ')}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <path
      d="M7 10V8a5 5 0 0 1 10 0v2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <rect
      x="5"
      y="10"
      width="14"
      height="11"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="15.5" r="1.25" fill="currentColor" />
    <path d="M12 16.75v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface ConnectLockBadgeProps {
  className?: string;
  size?: number;
}

/** Right-aligned lock badge — does not replace the control icon. */
export const ConnectLockBadge: React.FC<ConnectLockBadgeProps> = ({ className, size }) => (
  <span
    className={['linkedin-studio-connect-lock-badge', className].filter(Boolean).join(' ')}
    aria-hidden
  >
    <ConnectLockIcon size={size} />
  </span>
);
