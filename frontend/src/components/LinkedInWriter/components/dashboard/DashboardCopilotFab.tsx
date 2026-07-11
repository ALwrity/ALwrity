import React from 'react';

interface DashboardCopilotFabProps {
  onOpenCopilot: () => void;
  variant?: 'rail' | 'fixed' | 'corner';
  layout?: 'absolute' | 'stacked';
}

export const DashboardCopilotFab: React.FC<DashboardCopilotFabProps> = ({
  onOpenCopilot,
  variant = 'rail',
  layout = 'absolute',
}) => {
  const isFixed = variant === 'fixed';
  const isCorner = variant === 'corner';
  const isStacked = layout === 'stacked';
  const isRail = variant === 'rail';
  const buttonSize = isFixed || isCorner ? 56 : isRail ? 56 : 48;
  const showLabelBadge = isFixed || isCorner;

  return (
    <div
      className={
        isFixed
          ? 'linkedin-copilot-fab-fixed-inner'
          : isCorner
            ? 'linkedin-copilot-fab-corner-inner'
            : undefined
      }
      style={
        isFixed || isCorner
          ? undefined
          : isStacked
            ? {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                width: '100%',
                pointerEvents: 'auto',
              }
            : {
                position: 'absolute',
                left: '50%',
                bottom: 16,
                transform: 'translateX(-50%)',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                pointerEvents: 'auto',
              }
      }
    >
      <button
        type="button"
        onClick={onOpenCopilot}
        title="Ask ALwrity Co-Pilot"
        aria-label="Ask ALwrity Co-Pilot"
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: '50%',
          border: '3px solid #0a66c2',
          background: '#ffffff',
          padding: 0,
          cursor: 'pointer',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(10, 102, 194, 0.28)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <img
          src="/ask-alwrity-girl.png"
          alt="ALwrity Co-Pilot assistant"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />
      </button>
      <span
        style={{
          fontSize: isRail ? 9 : 8,
          fontWeight: 700,
          color: '#0a66c2',
          textAlign: 'center',
          maxWidth: isCorner ? 120 : 108,
          lineHeight: 1.2,
          ...(showLabelBadge
            ? {
                background: 'rgba(255,255,255,0.92)',
                padding: '2px 6px',
                borderRadius: 8,
                border: '1px solid #BCE0FD',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }
            : {}),
        }}
      >
        Ask ALwrity Co-Pilot
      </span>
    </div>
  );
};
