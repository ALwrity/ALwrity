import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConnectLockIcon } from './ConnectLockIcon';
import { LINKEDIN_COPILOT_COMING_SOON_HINT } from '../../utils/linkedInConnectLockedUi';

interface DashboardCopilotFabProps {
  onOpenCopilot: () => void;
  variant?: 'rail' | 'fixed' | 'corner';
  layout?: 'absolute' | 'stacked';
  /** Co-Pilot chat is not live yet — show lock + coming-soon hover instead of opening. */
  comingSoon?: boolean;
}

export const DashboardCopilotFab: React.FC<DashboardCopilotFabProps> = ({
  onOpenCopilot,
  variant = 'rail',
  layout = 'absolute',
  comingSoon = true,
}) => {
  const isFixed = variant === 'fixed';
  const isCorner = variant === 'corner';
  const isStacked = layout === 'stacked';
  const isRail = variant === 'rail';
  const buttonSize = isFixed || isCorner ? 56 : isRail ? 56 : 48;
  const showLabelBadge = isFixed || isCorner;
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pinnedHintRef = useRef(false);
  const [showSoonHint, setShowSoonHint] = useState(false);
  const [hintPos, setHintPos] = useState({ top: 0, left: 0 });
  const [hintPlacement, setHintPlacement] = useState<'above' | 'below'>('above');

  const syncHintPosition = useCallback(() => {
    const node = btnRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceAbove >= 72 || spaceAbove >= spaceBelow;
    setHintPlacement(placeAbove ? 'above' : 'below');
    setHintPos({
      top: placeAbove ? rect.top - 10 : rect.bottom + 10,
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 148),
        window.innerWidth - 148
      ),
    });
  }, []);

  const openSoonHint = useCallback(() => {
    syncHintPosition();
    setShowSoonHint(true);
  }, [syncHintPosition]);

  const closeSoonHint = useCallback(() => {
    if (pinnedHintRef.current) return;
    setShowSoonHint(false);
  }, []);

  const dismissSoonHint = useCallback(() => {
    pinnedHintRef.current = false;
    setShowSoonHint(false);
  }, []);

  useEffect(() => {
    if (!showSoonHint) return undefined;
    const onReposition = () => syncHintPosition();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [showSoonHint, syncHintPosition]);

  useEffect(() => {
    if (!showSoonHint) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      dismissSoonHint();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showSoonHint, dismissSoonHint]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (comingSoon) {
      event.preventDefault();
      event.stopPropagation();
      if (showSoonHint && pinnedHintRef.current) {
        dismissSoonHint();
      } else {
        pinnedHintRef.current = true;
        syncHintPosition();
        setShowSoonHint(true);
      }
      return;
    }
    onOpenCopilot();
  };

  const innerClass = [
    isFixed ? 'linkedin-copilot-fab-fixed-inner' : isCorner ? 'linkedin-copilot-fab-corner-inner' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconControl = (
    <div
      ref={wrapRef}
      className={
        comingSoon
          ? 'linkedin-copilot-fab-btn-wrap linkedin-copilot-fab-btn-wrap--coming-soon'
          : 'linkedin-copilot-fab-btn-wrap'
      }
    >
      <button
        ref={btnRef}
        type="button"
        className="linkedin-copilot-fab-btn"
        onClick={handleClick}
        onMouseEnter={comingSoon ? openSoonHint : undefined}
        onMouseLeave={comingSoon ? closeSoonHint : undefined}
        aria-label={
          comingSoon
            ? 'ALwrity Co-Pilot — coming in the next release'
            : 'Ask ALwrity Co-Pilot'
        }
        aria-disabled={comingSoon}
        aria-describedby={comingSoon && showSoonHint ? 'linkedin-copilot-soon-hint' : undefined}
        title={comingSoon ? undefined : 'Ask ALwrity Co-Pilot'}
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: '50%',
          border: '3px solid #0a66c2',
          background: '#ffffff',
          padding: 0,
          cursor: comingSoon ? 'default' : 'pointer',
          overflow: 'visible',
          boxShadow: '0 8px 24px rgba(10, 102, 194, 0.28)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          position: 'relative',
        }}
      >
        <span className="linkedin-copilot-fab-btn-photo" aria-hidden>
          <img
            src="/ask-alwrity-girl.png"
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              borderRadius: '50%',
            }}
          />
        </span>
        {comingSoon && (
          <span className="linkedin-copilot-fab-lock-badge">
            <ConnectLockIcon size={9} />
          </span>
        )}
      </button>
      {comingSoon &&
        showSoonHint &&
        createPortal(
          <span
            id="linkedin-copilot-soon-hint"
            className={[
              'linkedin-copilot-fab-soon-tooltip',
              'linkedin-copilot-fab-soon-tooltip--portal',
              hintPlacement === 'below' && 'linkedin-copilot-fab-soon-tooltip--portal-below',
            ]
              .filter(Boolean)
              .join(' ')}
            role="tooltip"
            style={{
              top: hintPos.top,
              left: hintPos.left,
              opacity: 1,
              visibility: 'visible',
            }}
          >
            {LINKEDIN_COPILOT_COMING_SOON_HINT}
          </span>,
          document.body
        )}
    </div>
  );

  return (
    <div
      className={innerClass || undefined}
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
      {iconControl}
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
