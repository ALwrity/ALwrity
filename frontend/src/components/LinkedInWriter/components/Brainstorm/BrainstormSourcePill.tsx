import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BrainstormSource } from '../../hooks/usePlanWedgeBrainstorm';
import { LI_Z_KNOWLEDGE_CENTER } from '../../utils/linkedInStudioZIndex';
import { truncateSnippet } from './brainstormSourceUtils';

interface BrainstormSourcePillProps {
  sourceIndex: number;
  source: BrainstormSource;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Last idea cards sit near the modal bottom — show tooltip above-right of the pill. */
  preferTooltipAboveRight?: boolean;
}

interface TooltipState {
  top: number;
  left: number;
  placement: 'top' | 'top-right' | 'right' | 'left';
}

/** 40% wider than the original 280px tooltip for easier reading. */
const TOOLTIP_MAX_WIDTH = Math.round(280 * 1.4);
const TOOLTIP_MARGIN = 8;
const TOOLTIP_GAP = 10;

function computeTooltipPosition(
  anchor: DOMRect,
  preferAboveRight = false
): TooltipState {
  if (preferAboveRight) {
    let left = anchor.right + TOOLTIP_GAP;
    left = Math.min(left, window.innerWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_MARGIN);
    left = Math.max(TOOLTIP_MARGIN, left);
    const top = Math.max(TOOLTIP_MARGIN, anchor.top - TOOLTIP_GAP);
    return { top, left, placement: 'top-right' };
  }

  const spaceRight = window.innerWidth - anchor.right - TOOLTIP_MARGIN;
  const spaceLeft = anchor.left - TOOLTIP_MARGIN;
  const minWidthNeeded = Math.min(TOOLTIP_MAX_WIDTH, 220);

  const placement: 'right' | 'left' =
    spaceRight >= minWidthNeeded + TOOLTIP_GAP || spaceRight >= spaceLeft ? 'right' : 'left';

  let left =
    placement === 'right'
      ? anchor.right + TOOLTIP_GAP
      : anchor.left - TOOLTIP_GAP;

  if (placement === 'right') {
    left = Math.min(left, window.innerWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_MARGIN);
    left = Math.max(left, TOOLTIP_MARGIN);
  } else {
    left = Math.max(left, TOOLTIP_MARGIN);
    left = Math.min(left, window.innerWidth - TOOLTIP_MARGIN);
  }

  const top = Math.max(
    TOOLTIP_MARGIN,
    Math.min(anchor.top, window.innerHeight - 180 - TOOLTIP_MARGIN)
  );

  return { top, left, placement };
}

const BrainstormSourcePill: React.FC<BrainstormSourcePillProps> = ({
  sourceIndex,
  source,
  expanded,
  onToggleExpand,
  preferTooltipAboveRight = false,
}) => {
  const pillRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const updateTooltipPosition = useCallback(() => {
    const anchor = pillRef.current?.getBoundingClientRect();
    if (!anchor) return;
    setTooltip(computeTooltipPosition(anchor, preferTooltipAboveRight));
  }, [preferTooltipAboveRight]);

  const dismissTooltip = useCallback(() => {
    setHovered(false);
    setTooltip(null);
  }, []);

  const showTooltip = hovered && !expanded;

  useEffect(() => {
    if (expanded) {
      dismissTooltip();
    }
  }, [expanded, dismissTooltip]);

  useEffect(() => {
    if (!showTooltip) return undefined;

    updateTooltipPosition();
    const onReposition = () => updateTooltipPosition();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [showTooltip, updateTooltipPosition]);

  const pillLabel = `Source [${sourceIndex}]: ${truncateSnippet(source.snippet || source.title)}`;

  return (
    <div className="plan-wedge-brainstorm__source-pill-wrap">
      <button
        ref={pillRef}
        type="button"
        className={[
          'plan-wedge-brainstorm__source-pill',
          expanded && 'plan-wedge-brainstorm__source-pill--expanded',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-expanded={expanded}
        aria-describedby={showTooltip ? tooltipId : undefined}
        onMouseEnter={() => {
          if (expanded) return;
          setHovered(true);
          updateTooltipPosition();
        }}
        onMouseLeave={dismissTooltip}
        onFocus={() => {
          if (expanded) return;
          setHovered(true);
          updateTooltipPosition();
        }}
        onBlur={dismissTooltip}
        onClick={() => {
          dismissTooltip();
          onToggleExpand();
        }}
      >
        {pillLabel}
      </button>

      {expanded && (
        <div className="plan-wedge-brainstorm__source-expand" role="region" aria-label={`Source ${sourceIndex} details`}>
          <div className="plan-wedge-brainstorm__source-expand-header">
            <div className="plan-wedge-brainstorm__source-expand-title">{source.title}</div>
            <button
              type="button"
              className="plan-wedge-brainstorm__source-expand-close"
              aria-label="Close source details"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              ×
            </button>
          </div>
          <p className="plan-wedge-brainstorm__source-expand-snippet">{source.snippet}</p>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="plan-wedge-brainstorm__source-expand-link"
              onClick={(e) => e.stopPropagation()}
            >
              Read full source
            </a>
          )}
        </div>
      )}

      {showTooltip &&
        tooltip &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className={[
              'plan-wedge-brainstorm__source-tooltip',
              tooltip.placement === 'top' && 'plan-wedge-brainstorm__source-tooltip--top',
              tooltip.placement === 'top-right' &&
                'plan-wedge-brainstorm__source-tooltip--top-right',
              tooltip.placement === 'right' && 'plan-wedge-brainstorm__source-tooltip--right',
              tooltip.placement === 'left' && 'plan-wedge-brainstorm__source-tooltip--left',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              position: 'fixed',
              top: tooltip.top,
              left: tooltip.left,
              zIndex: LI_Z_KNOWLEDGE_CENTER + 1,
              width: TOOLTIP_MAX_WIDTH,
              maxWidth: TOOLTIP_MAX_WIDTH,
              transform:
                tooltip.placement === 'top' || tooltip.placement === 'top-right'
                  ? 'translateY(-100%)'
                  : tooltip.placement === 'left'
                    ? 'translateX(-100%)'
                    : undefined,
            }}
          >
            <div className="plan-wedge-brainstorm__source-tooltip-title">{source.title}</div>
            <p className="plan-wedge-brainstorm__source-tooltip-snippet">{source.snippet}</p>
          </div>,
          document.body
        )}
    </div>
  );
};

export default BrainstormSourcePill;
