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
}

export const DashboardToolTile: React.FC<DashboardToolTileProps> = ({
  title,
  description,
  icon,
  accent = '#0a66c2',
  onClick,
  variant = 'tile',
}) => {
  const [hovered, setHovered] = useState(false);

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '10px 22px',
          borderRadius: 999,
          border: `2px solid ${accent}`,
          background: hovered ? '#f0f9ff' : '#ffffff',
          color: accent,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 160ms ease, transform 160ms ease',
          transform: hovered ? 'translateY(-2px)' : 'none',
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
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        padding: '14px 10px',
        minHeight: 132,
        width: '100%',
        background: '#ffffff',
        border: `2px solid ${FRAME_COLOR}`,
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'center',
        boxShadow: hovered ? `0 8px 24px ${accent}22` : '0 2px 8px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{title}</span>
      {description && (
        <span
          style={{
            fontSize: 11,
            color: '#6b7280',
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
