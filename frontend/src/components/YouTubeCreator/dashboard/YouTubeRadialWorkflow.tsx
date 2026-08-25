import React, { useEffect, useState } from "react";
import {
  YOUTUBE_WORKFLOW_CARDS,
  FRAME_COLOR,
  PLAN_PINNED_HINT_KEY,
  RECOMMENDED_WORKFLOW_CARD_ID,
  WEDGE_PANEL_GAP_DEG,
  resolveYouTubeWorkflowIcon,
  type YouTubeWorkflowCardId,
} from "./youtubeWorkflowConfig";
import { isWedgeConnectGated } from "./studioHubAccessConfig";
import type { YouTubeRadialLayout } from "./youtubeRadialLayout";
import { YouTubePlanStartHereBadge } from "./YouTubePlanStartHereBadge";
import { isYouTubePlanWedge, youtubePlanWedgeLabelLayout } from "./youtubePlanWedgeUi";
import { ConnectLockBadge } from "../../LinkedInWriter/components/dashboard/ConnectLockIcon";
import {
  youtubeWedgeHeaderTextGap,
  youtubeWedgeIconHeaderGap,
  youtubeWedgeLabelBoxWidth,
} from "./youtubeRadialWedgeUi";

interface YouTubeRadialWorkflowProps {
  layout: YouTubeRadialLayout;
  onCardAction: (cardId: YouTubeWorkflowCardId) => void;
  connected?: boolean;
}

const PANEL_GAP_DEGREES = WEDGE_PANEL_GAP_DEG;
const OUTER_BULGE_FACTOR = 0.14;
const HOVER_POP_PX = 10;
const HOVER_SCALE = 1.06;

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  return prefersReducedMotion;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  return { x: cx + r * Math.cos(toRad(deg)), y: cy - r * Math.sin(toRad(deg)) };
}

function accentFill(accent: string, alpha = 0.16): string {
  const hex = accent.replace("#", "");
  if (hex.length !== 6) return `rgba(255, 0, 0, ${alpha})`;
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
  isActive: boolean,
): string {
  if (!isActive) return "";
  const mid = (startDeg + endDeg) / 2;
  const pivot = polar(centerX, centerY, (innerR + outerR) / 2, mid);
  const offset = polar(0, 0, HOVER_POP_PX, mid);
  return [
    `translate(${pivot.x + offset.x} ${pivot.y + offset.y})`,
    `scale(${HOVER_SCALE})`,
    `translate(${-pivot.x} ${-pivot.y})`,
  ].join(" ");
}

function describeWedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
): string {
  const mid = (startDeg + endDeg) / 2;
  const iStart = polar(cx, cy, rInner, startDeg);
  const iEnd = polar(cx, cy, rInner, endDeg);
  const oStart = polar(cx, cy, rOuter, startDeg);
  const oEnd = polar(cx, cy, rOuter, endDeg);
  const oBulge = polar(cx, cy, rOuter * (1 + OUTER_BULGE_FACTOR), mid);
  const span = Math.abs(startDeg - endDeg);
  const largeArc = span > 180 ? 1 : 0;
  return [
    `M ${iStart.x} ${iStart.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${iEnd.x} ${iEnd.y}`,
    `L ${oEnd.x} ${oEnd.y}`,
    `Q ${oBulge.x} ${oBulge.y} ${oStart.x} ${oStart.y}`,
    "Z",
  ].join(" ");
}

function wedgeLabelBox(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
  labelBoxWidth: number,
) {
  const mid = (startDeg + endDeg) / 2;
  const center = polar(cx, cy, (innerR + outerR) / 2, mid);
  const height = Math.max(76, (outerR - innerR) * 0.98);
  return {
    x: center.x - labelBoxWidth / 2,
    y: center.y - height / 2,
    width: labelBoxWidth,
    height,
  };
}

export const YouTubeRadialWorkflow: React.FC<YouTubeRadialWorkflowProps> = ({
  layout,
  onCardAction,
  connected = true,
}) => {
  const [hoveredId, setHoveredId] = useState<YouTubeWorkflowCardId | null>(null);
  const [focusedId, setFocusedId] = useState<YouTubeWorkflowCardId | null>(null);
  const [showRecommendedHint, setShowRecommendedHint] = useState(
    () => !sessionStorage.getItem(PLAN_PINNED_HINT_KEY),
  );
  const prefersReducedMotion = usePrefersReducedMotion();
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
  const showRecommended = !highlightedId && showRecommendedHint;

  const handleCardAction = (cardId: YouTubeWorkflowCardId) => {
    if (cardId === RECOMMENDED_WORKFLOW_CARD_ID && showRecommendedHint) {
      sessionStorage.setItem(PLAN_PINNED_HINT_KEY, "1");
      setShowRecommendedHint(false);
    }
    onCardAction(cardId);
  };

  const orderedCards = [...YOUTUBE_WORKFLOW_CARDS].sort((a, b) => {
    if (a.id === highlightedId) return 1;
    if (b.id === highlightedId) return -1;
    return 0;
  });

  const renderWedge = (card: (typeof YOUTUBE_WORKFLOW_CARDS)[number]) => {
    const isHovered = hoveredId === card.id;
    const isFocused = focusedId === card.id;
    const isActive = isHovered || isFocused;
    const isPlanWedge = isYouTubePlanWedge(card.id);
    const isRecommended = showRecommended && isPlanWedge;
    const planLabelLayout = youtubePlanWedgeLabelLayout(isPlanWedge);
    const isConnectLocked = isWedgeConnectGated(card.id, connected);
    const panelStartDeg = card.startAngle - PANEL_GAP_DEGREES;
    const panelEndDeg = card.endAngle + PANEL_GAP_DEGREES;
    const iconHeaderGap = youtubeWedgeIconHeaderGap(iconFontSize);
    const headerTextGap = youtubeWedgeHeaderTextGap(descFontSize);
    const box = wedgeLabelBox(
      centerX,
      centerY,
      innerR,
      outerR,
      card.startAngle,
      card.endAngle,
      youtubeWedgeLabelBoxWidth(card.id, labelBoxWidth),
    );
    const wedgePath = describeWedge(
      centerX,
      centerY,
      innerR,
      outerR,
      panelStartDeg,
      panelEndDeg,
    );
    const WorkflowIcon = resolveYouTubeWorkflowIcon(card.id);

    return (
      <g
        key={card.id}
        className={[
          "workflow-wedge",
          isRecommended && "workflow-wedge--recommended",
          isConnectLocked && "workflow-wedge--connect-locked",
        ]
          .filter(Boolean)
          .join(" ")}
        data-tour={`yt-wedge-${card.id}`}
        transform={wedgeTransform(
          centerX,
          centerY,
          innerR,
          outerR,
          card.startAngle,
          card.endAngle,
          isActive && !prefersReducedMotion,
        )}
        style={{
          cursor: "pointer",
          outline: "none",
          transition: prefersReducedMotion
            ? "fill 180ms ease, stroke 180ms ease, filter 180ms ease"
            : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
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
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardAction(card.id);
          }
        }}
      >
        {isConnectLocked && (
          <title>Connect YouTube to unlock {card.title}</title>
        )}
        <path
          className="workflow-wedge-base"
          d={wedgePath}
          fill={
            isConnectLocked
              ? "rgba(226, 232, 240, 0.88)"
              : isActive
                ? accentFill(card.accent, 0.2)
                : isRecommended
                  ? accentFill(card.accent, 0.08)
                  : "url(#ytWedgeFill)"
          }
          stroke={
            isConnectLocked
              ? "rgba(148, 163, 184, 0.5)"
              : isActive || isRecommended
                ? card.accent
                : FRAME_COLOR
          }
          strokeWidth={isActive ? 3 : isRecommended ? 2.4 : 1.2}
          strokeLinejoin="round"
          style={{
            transition: "fill 180ms ease, stroke 180ms ease, filter 180ms ease",
            filter: isConnectLocked
              ? "saturate(0.68) brightness(1.02)"
              : isActive
                ? `drop-shadow(0 18px 34px ${accentFill(card.accent, 0.65)}) drop-shadow(0 8px 12px rgba(0,0,0,0.1))`
                : isRecommended
                  ? undefined
                  : "drop-shadow(0 2px 8px rgba(255,0,0,0.12)) drop-shadow(0 4px 6px rgba(0,0,0,0.05))",
          }}
        />
        {isConnectLocked && (
          <path
            d={wedgePath}
            fill="rgba(255, 255, 255, 0.22)"
            stroke="none"
            pointerEvents="none"
            aria-hidden
          />
        )}
        <foreignObject
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            overflow: "visible",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: planLabelLayout.justifyContent,
              textAlign: "center",
              padding: planLabelLayout.padding,
              boxSizing: "border-box",
            }}
          >
            {isPlanWedge && <YouTubePlanStartHereBadge />}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: planLabelLayout.innerFlex,
                minHeight: 0,
                width: "100%",
              }}
            >
              <div
                style={{
                  width: iconFontSize,
                  height: iconFontSize,
                  marginBottom: iconHeaderGap,
                  color: isActive ? card.accent : accentFill(card.accent, 0.75),
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 180ms ease",
                }}
              >
                <WorkflowIcon
                  sx={{ color: "currentColor", fontSize: iconFontSize, display: "block" }}
                  aria-hidden
                  focusable={false}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: Math.max(3, Math.round(labelFontSize * 0.28)),
                  fontSize: labelFontSize,
                  fontWeight: 800,
                  color: isActive ? card.accent : "#0f172a",
                  lineHeight: 1.12,
                  marginBottom: headerTextGap,
                  transition: "color 180ms ease",
                }}
              >
                <span>{card.title}</span>
                {isConnectLocked && <ConnectLockBadge size={8} />}
              </div>
              <div
                style={{
                  fontSize: descFontSize,
                  fontWeight: 500,
                  color: isActive ? "#334155" : "#475569",
                  lineHeight: 1.28,
                  maxWidth: "100%",
                  overflowWrap: "break-word",
                }}
              >
                {card.description}
              </div>
            </div>
          </div>
        </foreignObject>
      </g>
    );
  };

  const glowR = outerR * 1.4;

  return (
    <svg
      viewBox={`0 ${viewBoxY} ${viewW} ${viewH}`}
      width="100%"
      height={viewH}
      style={{ display: "block", overflow: "hidden" }}
      aria-label="YouTube Creator Studio workflow"
    >
      <defs>
        <radialGradient id="yt-wedge-ring-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,0,0,0.06)" />
          <stop offset="45%" stopColor="rgba(255,0,0,0.14)" />
          <stop offset="100%" stopColor="rgba(255,0,0,0)" />
        </radialGradient>
        <linearGradient id="ytWedgeFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fff5f5" />
        </linearGradient>
      </defs>
      <circle
        cx={centerX}
        cy={centerY}
        r={glowR}
        fill="url(#yt-wedge-ring-glow)"
        style={{ pointerEvents: "none" }}
      />
      {orderedCards.map(renderWedge)}
    </svg>
  );
};
