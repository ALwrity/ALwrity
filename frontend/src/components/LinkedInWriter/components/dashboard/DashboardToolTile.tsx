import React, { useEffect, useState } from 'react';
import { FRAME_COLOR } from './dashboardWorkflowConfig';

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

interface DashboardToolTileProps {
  title: string;
  description?: string;
  icon: string;
  accent?: string;
  onClick: () => void;
  /** Pill-shaped button instead of square tile */
  variant?: 'tile' | 'pill';
  disabled?: boolean;
  disabledReason?: string;
}

export const DashboardToolTile: React.FC<DashboardToolTileProps> = ({
  title,
  description,
  icon,
  accent = '#0a66c2',
  onClick,
  variant = 'tile',
  disabled = false,
  disabledReason,
}) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isInteractive = !disabled;
  const isActive = isInteractive && (hovered || focused);

  const handleClick = () => {
    if (disabled) return;
    onClick();
  };

  if (variant === 'pill') {
    return (
      <button
        type="button"
        className="linkedin-dashboard-tool-pill"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        title={disabled ? (disabledReason || title) : title}
        style={{
          padding: '10px 22px',
          borderRadius: 999,
          border: `2px solid ${disabled ? '#d1d5db' : accent}`,
          background: disabled ? '#f9fafb' : isActive ? '#f0f9ff' : '#ffffff',
          color: disabled ? '#9ca3af' : accent,
          fontSize: 14,
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isActive ? `0 0 0 3px ${accent}22` : 'none',
          transition: prefersReducedMotion
            ? 'background 160ms ease, box-shadow 160ms ease'
            : 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease',
          transform: isActive && !prefersReducedMotion ? 'translateY(-2px)' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="linkedin-dashboard-tool-tile"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      title={disabled ? (disabledReason || title) : title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        padding: '14px 10px',
        minHeight: 132,
        width: '100%',
        background: disabled ? '#f9fafb' : isActive ? '#f8fbff' : '#ffffff',
        border: `2px solid ${disabled ? '#e5e7eb' : isActive ? accent : FRAME_COLOR}`,
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'center',
        boxShadow: disabled ? 'none' : isActive ? `0 8px 24px ${accent}22` : '0 2px 8px rgba(0,0,0,0.04)',
        transform: isActive && !prefersReducedMotion ? 'translateY(-4px) scale(1.02)' : 'none',
        transition: prefersReducedMotion
          ? 'border-color 160ms ease, background 160ms ease, box-shadow 160ms ease'
          : 'transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: disabled ? '#9ca3af' : '#111827', lineHeight: 1.2 }}>{title}</span>
      {description && (
        <span
          style={{
            fontSize: 11,
            color: disabled ? '#d1d5db' : '#6b7280',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </span>
      )}
    </button>
  );
};
