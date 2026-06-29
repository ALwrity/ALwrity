import React, { useState } from 'react';
import {
  DASHBOARD_WORKFLOW_CARDS,
  FRAME_COLOR,
  WEDGE_PANEL_GAP_DEG,
  type DashboardWorkflowCardId,
} from './dashboardWorkflowConfig';
import type { RadialLayout } from './dashboardRadialLayout';

interface DashboardRadialWorkflowProps {
  layout: RadialLayout;
  onCardAction: (cardId: DashboardWorkflowCardId) => void;
}

interface LabelPolish {
  descWidthScale: number;
}

const LABEL_POLISH: Partial<Record<DashboardWorkflowCardId, LabelPolish>> = {
  plan: { descWidthScale: 0.92 },
  create: { descWidthScale: 0.9 },
  publish: { descWidthScale: 0.9 },
  analysis: { descWidthScale: 0.88 },
  engagement: { descWidthScale: 0.86 },
  remarket: { descWidthScale: 0.9 },
};

const RECOMMENDED_CARD_ID: DashboardWorkflowCardId = 'plan';
const PLAN_PINNED_HINT_KEY = 'linkedin_dashboard_plan_hint_dismissed';
const PANEL_GAP_DEGREES = WEDGE_PANEL_GAP_DEG;
const OUTER_BULGE_FACTOR = 0.14;
const HOVER_POP_PX = 10;
const HOVER_SCALE = 1.06;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(toRad(deg)),
    y: cy - r * Math.sin(toRad(deg)),
  };
}

function accentFill(accent: string, alpha = 0.16): string {
  const hex = accent.replace('#', '');
  if (hex.length !== 6) return `rgba(10, 102, 194, ${alpha})`;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wedgeTransform(
  centerX: number,
  centerY: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
  isActive: boolean
): string {
  if (!isActive) return '';
  const mid = (startDeg + endDeg) / 2;
  const pivot = polar(centerX, centerY, (innerR + outerR) / 2, mid);
  const offset = polar(0, 0, HOVER_POP_PX, mid);
  return [
    `translate(${pivot.x + offset.x} ${pivot.y + offset.y})`,
    `scale(${HOVER_SCALE})`,
    `translate(${-pivot.x} ${-pivot.y})`,
  ].join(' ');
}

/** Annular wedge — inner circular arc; outer edge bulges outward (convex). */
function describeWedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
  outerBulgeFactor = OUTER_BULGE_FACTOR
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
  const center = polar(cx, cy, (innerR + outerR) / 2, mid);
  const height = Math.max(52, (outerR - innerR) * 0.92);
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

  const orderedCards = [...DASHBOARD_WORKFLOW_CARDS].sort((a, b) => {
    if (a.id === highlightedId) return 1;
    if (b.id === highlightedId) return -1;
    return 0;
  });

  const renderWedge = (card: (typeof DASHBOARD_WORKFLOW_CARDS)[number]) => {
    const isHovered = hoveredId === card.id;
    const isFocused = focusedId === card.id;
    const isActive = isHovered || isFocused;
    const isRecommended = showRecommendedHint && card.id === RECOMMENDED_CARD_ID;
    const panelStartDeg = card.startAngle - PANEL_GAP_DEGREES;
    const panelEndDeg = card.endAngle + PANEL_GAP_DEGREES;
    const polish = LABEL_POLISH[card.id] ?? { descWidthScale: 0.9 };
    const box = wedgeLabelBox(
      centerX,
      centerY,
      innerR,
      outerR,
      card.startAngle,
      card.endAngle,
      labelBoxWidth * polish.descWidthScale
    );
    const wedgePath = describeWedge(
      centerX,
      centerY,
      innerR,
      outerR,
      panelStartDeg,
      panelEndDeg
    );

    return (
      <g
        key={card.id}
        className="workflow-wedge"
        data-tour={`li-wedge-${card.id}`}
        transform={wedgeTransform(
          centerX,
          centerY,
          innerR,
          outerR,
          card.startAngle,
          card.endAngle,
          isActive
        )}
        style={{
          cursor: 'pointer',
          outline: 'none',
          transition: 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
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
          d={wedgePath}
          fill={isActive ? accentFill(card.accent, 0.2) : isRecommended ? accentFill(card.accent, 0.08) : '#ffffff'}
          stroke={isActive || isRecommended ? card.accent : FRAME_COLOR}
          strokeWidth={isActive ? 3 : isRecommended ? 2.4 : 2.2}
          strokeLinejoin="round"
          style={{
            transition: 'fill 180ms ease, stroke 180ms ease, filter 180ms ease',
            filter: isActive
              ? `drop-shadow(0 10px 22px ${accentFill(card.accent, 0.45)})`
              : 'drop-shadow(0 2px 6px rgba(10,102,194,0.08)',
          }}
        />
        <foreignObject
          x={box.x}
          y={box.y}
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
              padding: '2px 5px',
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
                color: isActive ? card.accent : '#0f172a',
                lineHeight: 1.15,
                transition: 'color 180ms ease',
              }}
            >
              {card.title}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: descFontSize,
                fontWeight: 500,
                color: isActive ? '#334155' : '#475569',
                lineHeight: 1.3,
              }}
            >
              {card.description}
            </div>
            {isRecommended && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: Math.max(8, descFontSize - 1),
                  fontWeight: 700,
                  color: card.accent,
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
  };

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
      {orderedCards.map(renderWedge)}
    </svg>
  );
};
