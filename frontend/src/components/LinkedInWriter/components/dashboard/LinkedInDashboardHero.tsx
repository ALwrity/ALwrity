import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DashboardRadialWorkflow } from './DashboardRadialWorkflow';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import { computeRadialLayout, layoutYToPixel, PLAN_CONNECT_UI_LIFT_PX, ringSpotlightDiameter } from './dashboardRadialLayout';

interface LinkedInDashboardHeroProps {
  children: React.ReactNode;
  planAnchorSlot?: React.ReactNode;
  onWorkflowCardAction: (cardId: DashboardWorkflowCardId) => void;
}

export const LinkedInDashboardHero: React.FC<LinkedInDashboardHeroProps> = ({
  children,
  planAnchorSlot,
  onWorkflowCardAction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);
  const [containerHeight, setContainerHeight] = useState(520);

  const readSize = () => {
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width > 0) setContainerWidth(width);
    if (height > 0) setContainerHeight(height);
  };

  useLayoutEffect(() => {
    readSize();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => readSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () => computeRadialLayout(containerWidth, containerHeight),
    [containerWidth, containerHeight]
  );
  const hubTop = layoutYToPixel(layout.centerY + layout.hubOffsetY, layout.viewBoxY);
  const planAnchorTop = layoutYToPixel(layout.planAnchorY, layout.viewBoxY);
  const ringCenterTop = layoutYToPixel(layout.centerY, layout.viewBoxY);
  const lifecycleSpotlightSize = ringSpotlightDiameter(layout.outerR);

  return (
    <div
      ref={containerRef}
      className="linkedin-dashboard-hero"
      style={{
        width: '100%',
        flex: 1,
        minHeight: 240,
        flexShrink: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        overflow: 'visible',
        position: 'relative',
        paddingTop: 0,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: layout.viewH,
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <DashboardRadialWorkflow layout={layout} onCardAction={onWorkflowCardAction} />

        {/* Invisible tour anchors — tight bounds for Joyride spotlight */}
        <div
          data-tour="li-content-lifecycle"
          className="linkedin-tour-lifecycle-spotlight"
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: ringCenterTop,
            width: lifecycleSpotlightSize,
            height: lifecycleSpotlightSize,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="linkedin-dashboard-hero-hub"
          style={{
            position: 'absolute',
            left: '50%',
            top: hubTop,
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            width: '100%',
            maxWidth: Math.max(220, layout.innerR * 2),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              overflow: 'visible',
            }}
          >
            {children}
          </div>
        </div>
        {planAnchorSlot && (
          <div
            className="linkedin-dashboard-plan-anchor"
            style={{
              position: 'absolute',
              left: layout.planAnchorX,
              top: planAnchorTop,
              transform: `translate(-50%, ${-PLAN_CONNECT_UI_LIFT_PX}px)`,
              zIndex: 20,
              pointerEvents: 'auto',
              display: 'flex',
              justifyContent: 'center',
              minWidth: 220,
            }}
          >
            {planAnchorSlot}
          </div>
        )}
      </div>
    </div>
  );
};
