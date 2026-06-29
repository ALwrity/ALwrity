import React, { useMemo, useState } from 'react';
import {
  DASHBOARD_WORKFLOW_CARDS,
  FRAME_COLOR,
  type DashboardWorkflowCardId,
} from './dashboardWorkflowConfig';
import type { RadialLayout } from './dashboardRadialLayout';

interface DashboardRadialWorkflowProps {
  layout: RadialLayout;
  onCardAction: (cardId: DashboardWorkflowCardId) => void;
}

interface LabelPolish {
  xOffset: number;
  yOffset: number;
  descWidthScale: number;
}

interface TooltipPlacement {
  card: (typeof DASHBOARD_WORKFLOW_CARDS)[number];
  x: number;
  y: number;
  width: number;
  height: number;
  side: 'left' | 'right' | 'top';
  anchorX: number;
  anchorY: number;
}

const LABEL_POLISH: Partial<Record<DashboardWorkflowCardId, LabelPolish>> = {
  plan: { xOffset: 6, yOffset: 4, descWidthScale: 0.88 },
  create: { xOffset: -4, yOffset: 0, descWidthScale: 0.82 },
  publish: { xOffset: 0, yOffset: -6, descWidthScale: 0.95 },
  analysis: { xOffset: 4, yOffset: 0, descWidthScale: 0.82 },
  engagement: { xOffset: 6, yOffset: 2, descWidthScale: 0.78 },
  remarket: { xOffset: -6, yOffset: 4, descWidthScale: 0.85 },
};

const RECOMMENDED_CARD_ID: DashboardWorkflowCardId = 'plan';
const PLAN_PINNED_HINT_KEY = 'linkedin_dashboard_plan_hint_dismissed';
const PANEL_GAP_DEGREES = 2.4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(toRad(deg)),
    y: cy - r * Math.sin(toRad(deg)),
  };
}

/** Donut wedge — inner arc at rInner; outer edge bulges outward (convex). */
function describeWedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
  outerBulgeFactor = 0.14
): string {
  const mid = (startDeg + endDeg) / 2;
  const iStart = polar(cx, cy, rInner, startDeg);
  const iEnd = polar(cx, cy, rInner, endDeg);
  const oStart = polar(cx, cy, rOuter, startDeg);
  const oEnd = polar(cx, cy, rOuter, endDeg);
  const oBulge = polar(cx, cy, rOuter * (1 + outerBulgeFactor), mid);
  const span = Math.abs(startDeg - endDeg);
  const largeArc = span > 180 ? 1 : 0;

  return [
    `M ${iStart.x} ${iStart.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${iEnd.x} ${iEnd.y}`,
    `L ${oEnd.x} ${oEnd.y}`,
    `Q ${oBulge.x} ${oBulge.y} ${oStart.x} ${oStart.y}`,
    'Z',
  ].join(' ');
}

function wedgeLabelBox(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
  labelBoxWidth: number
) {
  const mid = (startDeg + endDeg) / 2;
  const center = polar(cx, cy, (innerR + outerR) / 2 + 2, mid);
  const height = Math.max(52, (outerR - innerR) * 0.72);
  return {
    x: center.x - labelBoxWidth / 2,
    y: center.y - height / 2,
    width: labelBoxWidth,
    height,
  };
}

export const DashboardRadialWorkflow: React.FC<DashboardRadialWorkflowProps> = ({
  layout,
  onCardAction,
}) => {
  const [hoveredId, setHoveredId] = useState<DashboardWorkflowCardId | null>(null);
  const [focusedId, setFocusedId] = useState<DashboardWorkflowCardId | null>(null);
  const [showPlanPinnedHint, setShowPlanPinnedHint] = useState(
    () => !sessionStorage.getItem(PLAN_PINNED_HINT_KEY)
  );
  const {
    viewW,
    viewH,
    viewBoxY,
    centerX,
    centerY,
    innerR,
    outerR,
    labelFontSize,
    descFontSize,
    iconFontSize,
    labelBoxWidth,
  } = layout;
  const highlightedId = focusedId ?? hoveredId;
  const showRecommendedHint = !highlightedId && showPlanPinnedHint;

  const handleCardAction = (cardId: DashboardWorkflowCardId) => {
    if (cardId === RECOMMENDED_CARD_ID && showPlanPinnedHint) {
      sessionStorage.setItem(PLAN_PINNED_HINT_KEY, '1');
      setShowPlanPinnedHint(false);
    }
    onCardAction(cardId);
  };

  const activeCard = useMemo(
    () => DASHBOARD_WORKFLOW_CARDS.find((card) => card.id === highlightedId) ?? null,
    [highlightedId]
  );

  const activeTooltip = useMemo<TooltipPlacement | null>(() => {
    if (!activeCard) return null;
    const mid = (activeCard.startAngle + activeCard.endAngle) / 2;
    const anchor = polar(centerX, centerY, outerR + 28, mid);
    const width = 228;
    const height = 72;
    const gutter = 10;

    const preferredSide: 'left' | 'right' = anchor.x <= centerX ? 'right' : 'left';

    if (preferredSide === 'right') {
      const rightX = anchor.x + 14;
      const rightY = clamp(anchor.y - height / 2, viewBoxY + 8, viewBoxY + viewH - height - 8);
      if (rightX + width <= viewW - gutter) {
        return {
          card: activeCard,
          x: rightX,
          y: rightY,
          width,
          height,
          side: 'right',
          anchorX: anchor.x,
          anchorY: anchor.y,
        };
      }
    } else {
      const leftX = anchor.x - width - 14;
      const leftY = clamp(anchor.y - height / 2, viewBoxY + 8, viewBoxY + viewH - height - 8);
      if (leftX >= gutter) {
        return {
          card: activeCard,
          x: leftX,
          y: leftY,
          width,
          height,
          side: 'left',
          anchorX: anchor.x,
          anchorY: anchor.y,
        };
      }
    }

    const x = clamp(anchor.x - width / 2, gutter, viewW - width - gutter);
    const y = Math.max(viewBoxY + 8, anchor.y - height - 8);
    return {
      card: activeCard,
      x,
      y,
      width,
      height,
      side: 'top',
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
  }, [activeCard, centerX, centerY, outerR, viewBoxY, viewH, viewW]);

  return (
    <svg
      viewBox={`0 ${viewBoxY} ${viewW} ${viewH}`}
      width="100%"
      height={viewH}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="LinkedIn workflow"
    >
      <style>{`
        .workflow-wedge:focus-visible .workflow-wedge-base {
          stroke-width: 3px;
        }
      `}</style>
      {DASHBOARD_WORKFLOW_CARDS.map((card) => {
        const isHovered = hoveredId === card.id;
        const isFocused = focusedId === card.id;
        const isActive = isHovered || isFocused;
        const isRecommended = showRecommendedHint && card.id === RECOMMENDED_CARD_ID;
        const panelStartDeg = card.startAngle - PANEL_GAP_DEGREES;
        const panelEndDeg = card.endAngle + PANEL_GAP_DEGREES;
        const polish = LABEL_POLISH[card.id] ?? { xOffset: 0, yOffset: 0, descWidthScale: 0.85 };
        const box = wedgeLabelBox(
          centerX,
          centerY,
          innerR,
          outerR,
          card.startAngle,
          card.endAngle,
          labelBoxWidth * polish.descWidthScale
        );

        return (
          <g
            key={card.id}
            className="workflow-wedge"
            style={{ cursor: 'pointer', outline: 'none' }}
            onMouseEnter={() => setHoveredId(card.id)}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => setFocusedId(card.id)}
            onBlur={() => setFocusedId((prev) => (prev === card.id ? null : prev))}
            onClick={() => handleCardAction(card.id)}
            role="button"
            tabIndex={0}
            aria-label={`${card.title}: ${card.description}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardAction(card.id);
              }
            }}
          >
            <path
              className="workflow-wedge-base"
              d={describeWedge(
                centerX,
                centerY,
                innerR,
                outerR,
                panelStartDeg,
                panelEndDeg
              )}
              fill={isActive ? '#f0f9ff' : '#ffffff'}
              stroke={FRAME_COLOR}
              strokeWidth={isActive ? 2.8 : 2.2}
              strokeLinejoin="round"
              style={{
                transition: 'fill 160ms ease, stroke-width 160ms ease, filter 160ms ease',
                filter: isActive
                  ? 'drop-shadow(0 6px 16px rgba(10,102,194,0.22))'
                  : 'drop-shadow(0 2px 6px rgba(10,102,194,0.08))',
              }}
            />
            {(isActive || isRecommended) && (
              <path
                d={describeWedge(
                  centerX,
                  centerY,
                  innerR + 2,
                  outerR - 2,
                  panelStartDeg,
                  panelEndDeg
                )}
                fill="none"
                stroke={card.accent}
                strokeWidth={isActive ? 3 : 2.2}
                strokeOpacity={isActive ? 0.42 : 0.28}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <foreignObject
              x={box.x + polish.xOffset}
              y={box.y + polish.yOffset}
              width={box.width}
              height={box.height}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '2px 4px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ fontSize: iconFontSize, lineHeight: 1.1, marginBottom: 2 }}>
                  {card.icon}
                </div>
                <div
                  style={{
                    fontSize: labelFontSize,
                    fontWeight: 800,
                    color: '#0f172a',
                    lineHeight: 1.15,
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: descFontSize,
                    fontWeight: 500,
                    color: '#475569',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {card.description}
                </div>
                {isRecommended && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: Math.max(9, descFontSize - 1),
                      fontWeight: 700,
                      color: '#0a66c2',
                      lineHeight: 1.2,
                    }}
                  >
                    Recommended first step
                  </div>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}
      {activeTooltip && (
        <g style={{ pointerEvents: 'none' }}>
          <line
            x1={activeTooltip.anchorX}
            y1={activeTooltip.anchorY}
            x2={
              activeTooltip.side === 'right'
                ? activeTooltip.x
                : activeTooltip.side === 'left'
                  ? activeTooltip.x + activeTooltip.width
                  : activeTooltip.x + activeTooltip.width / 2
            }
            y2={
              activeTooltip.side === 'top'
                ? activeTooltip.y + activeTooltip.height
                : clamp(
                    activeTooltip.anchorY,
                    activeTooltip.y + 12,
                    activeTooltip.y + activeTooltip.height - 12
                  )
            }
            stroke={activeTooltip.card.accent}
            strokeOpacity={0.35}
            strokeWidth={1.5}
          />
          <foreignObject
            x={activeTooltip.x}
            y={activeTooltip.y}
            width={activeTooltip.width}
            height={activeTooltip.height}
          >
            <div
              style={{
                background: '#ffffff',
                border: `2px solid ${FRAME_COLOR}`,
                borderRadius: 10,
                boxShadow: '0 10px 28px rgba(10,102,194,0.18)',
                padding: '8px 10px',
                color: '#0f172a',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: activeTooltip.card.accent }}>
                {activeTooltip.card.title}
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: Math.max(11, descFontSize),
                  lineHeight: 1.35,
                  color: '#334155',
                }}
              >
                {activeTooltip.card.description}
              </div>
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
};
