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
import { DashboardMobileWorkflowGrid } from './DashboardMobileWorkflowGrid';

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
        alignItems: 'stretch',
        overflow: 'hidden',
        position: 'relative',
        paddingTop: 0,
        ['--hero-hub-left' as string]: hubCenterLeft,
        ['--hero-hub-top' as string]: `${hubTop}px`,
        ['--hero-connect-top' as string]: `${connectTop}px`,
        ['--hero-hub-size' as string]: `${hubDiameter}px`,
        ['--hero-avatar-size' as string]: `${hubAvatarSize}px`,
        ['--plan-connect-lift' as string]: `${PLAN_CONNECT_UI_LIFT_PX}px`,
      }}
    >
      {/* Desktop-only radial ring */}
      <div className="linkedin-dashboard-radial-desktop" aria-hidden="true">
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
        </div>
      </div>

      {/* Profile hub — single mount; positioned over radial on desktop, in-flow on mobile */}
      <div className="linkedin-dashboard-hero-profile-slot">
        <div
          className="linkedin-dashboard-hero-hub"
          style={{
            width: 'var(--hero-hub-size)',
            maxWidth: 'var(--hero-hub-size)',
            ['--hub-inner-diameter' as string]: 'var(--hero-hub-size)',
            ['--hub-avatar-size' as string]: 'var(--hero-avatar-size)',
          }}
        >
          {children}
        </div>
        {planAnchorSlot && (
          <div className="linkedin-dashboard-plan-anchor-slot">{planAnchorSlot}</div>
        )}
      </div>

      {/* Mobile-only 2-column workflow grid */}
      <div className="linkedin-dashboard-mobile-workflow-wrap">
        <DashboardMobileWorkflowGrid onCardAction={onWorkflowCardAction} />
      </div>
    </div>
  );
};
