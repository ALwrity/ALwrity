import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DashboardRadialWorkflow } from './DashboardRadialWorkflow';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import {
  computeRadialLayout,
  layoutConnectAnchorY,
  layoutHubCenterPercent,
  layoutHubCenterY,
  PLAN_CONNECT_UI_LIFT_PX,
  ringSpotlightDiameter,
} from './dashboardRadialLayout';

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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);
  const [containerHeight, setContainerHeight] = useState(640);

  const readSize = () => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const stage = el.closest('.linkedin-dashboard-hero-stage') as HTMLElement | null;
    const width = canvas.clientWidth;
    const stageHeight = stage?.clientHeight ?? 0;
    const height = stageHeight > 0 ? stageHeight : Math.max(el.clientHeight, 400);
    if (width > 0) setContainerWidth(width);
    if (height > 0) setContainerHeight(height);
  };

  useLayoutEffect(() => {
    readSize();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const stage = el.closest('.linkedin-dashboard-hero-stage');
    const ro = new ResizeObserver(() => readSize());
    if (canvasRef.current) ro.observe(canvasRef.current);
    ro.observe(el);
    if (stage) ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () => computeRadialLayout(containerWidth, containerHeight),
    [containerWidth, containerHeight]
  );
  const hubTop = layoutHubCenterY(layout);
  const connectTop = layoutConnectAnchorY(layout);
  const ringCenterTop = layoutHubCenterY(layout);
  const hubCenterLeft = `${layoutHubCenterPercent(layout)}%`;
  const lifecycleSpotlightSize = ringSpotlightDiameter(layout.outerR);
  const hubDiameter = layout.hubVisualR * 2;
  const hubAvatarSize = Math.min(120, Math.round(layout.hubVisualR * 1.38));

  return (
    <div
      ref={containerRef}
      className="linkedin-dashboard-hero"
      style={{
        width: '100%',
        flex: '0 1 auto',
        minHeight: 0,
        height: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        paddingTop: 0,
      }}
    >
      <div
        ref={canvasRef}
        className="linkedin-dashboard-hero-canvas"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
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
            left: hubCenterLeft,
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
            left: hubCenterLeft,
            top: hubTop,
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            width: hubDiameter,
            maxWidth: hubDiameter,
            ['--hub-inner-diameter' as string]: `${hubDiameter}px`,
            ['--hub-avatar-size' as string]: `${hubAvatarSize}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
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
              left: hubCenterLeft,
              top: connectTop,
              transform: `translate(-50%, calc(-1 * ${PLAN_CONNECT_UI_LIFT_PX}px))`,
              zIndex: 20,
              pointerEvents: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            {planAnchorSlot}
          </div>
        )}
      </div>
    </div>
  );
};
