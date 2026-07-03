import React, { useState } from 'react';
import { FRAME_COLOR } from './dashboardWorkflowConfig';

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

  const handleClick = () => {
    if (disabled) return;
    onClick();
  };

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={disabled ? (disabledReason || title) : title}
        style={{
          padding: '10px 22px',
          borderRadius: 999,
          border: `2px solid ${disabled ? '#d1d5db' : accent}`,
          background: disabled ? '#f9fafb' : hovered ? '#f0f9ff' : '#ffffff',
          color: disabled ? '#9ca3af' : accent,
          fontSize: 14,
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 160ms ease, transform 160ms ease',
          transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
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
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        background: disabled ? '#f9fafb' : '#ffffff',
        border: `2px solid ${disabled ? '#e5e7eb' : FRAME_COLOR}`,
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'center',
        boxShadow: disabled ? 'none' : hovered ? `0 8px 24px ${accent}22` : '0 2px 8px rgba(0,0,0,0.04)',
        transform: hovered && !disabled ? 'translateY(-4px) scale(1.02)' : 'none',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
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
