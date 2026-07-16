import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DashboardRadialWorkflow } from './DashboardRadialWorkflow';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import {
  computeRadialLayout,
  layoutConnectAnchorY,
  layoutHubCenterLeftCss,
  layoutHubCenterY,
  PLAN_CONNECT_UI_LIFT_PX,
  ringSpotlightDiameter,
} from './dashboardRadialLayout';
import { DashboardMobileWorkflowGrid } from './DashboardMobileWorkflowGrid';
import { useDesktopViewport } from '../../hooks/useDesktopViewport';
import { HUB_CENTER_LEFT_CSS_VAR } from './dashboardLayoutConstants';

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
  const desktopViewport = useDesktopViewport();
  const [containerWidth, setContainerWidth] = useState(640);
  const [containerHeight, setContainerHeight] = useState(640);

  const readSize = useCallback(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const stage = el.closest('.linkedin-dashboard-hero-stage') as HTMLElement | null;
    const width = canvas.clientWidth;
    const stageHeight = stage?.clientHeight ?? 0;
    const viewportStageFallback =
      typeof window !== 'undefined' ? Math.max(window.innerHeight - 152, 520) : 640;
    const height =
      stageHeight > 0
        ? stageHeight
        : desktopViewport
          ? viewportStageFallback
          : Math.max(el.clientHeight, 400);
    if (width > 0) setContainerWidth(width);
    if (height > 0) setContainerHeight(height);
  }, [desktopViewport]);

  const layout = useMemo(
    () => computeRadialLayout(containerWidth, containerHeight, desktopViewport),
    [containerWidth, containerHeight, desktopViewport]
  );
  const hubTop = layoutHubCenterY(layout);
  const connectTop = layoutConnectAnchorY(layout);
  const ringCenterTop = layoutHubCenterY(layout);
  const hubCenterLeft = layoutHubCenterLeftCss(layout);
  const hubAxisLeft = desktopViewport ? `var(${HUB_CENTER_LEFT_CSS_VAR})` : hubCenterLeft;
  const lifecycleSpotlightSize = ringSpotlightDiameter(layout.outerR);
  const hubDiameter = layout.hubVisualR * 2;
  const hubAvatarSize = Math.min(120, Math.round(layout.hubVisualR * 1.38));

  const syncHubAxis = useCallback(() => {
    const stage = containerRef.current?.closest('.linkedin-dashboard-hero-stage') as HTMLElement | null;
    if (!stage) return;
    if (desktopViewport) {
      stage.style.setProperty(HUB_CENTER_LEFT_CSS_VAR, hubCenterLeft);
    } else {
      stage.style.removeProperty(HUB_CENTER_LEFT_CSS_VAR);
    }
  }, [desktopViewport, hubCenterLeft]);

  useLayoutEffect(() => {
    readSize();
    syncHubAxis();
  }, [readSize, syncHubAxis]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const stage = el.closest('.linkedin-dashboard-hero-stage');
    const ro = new ResizeObserver(() => {
      readSize();
      syncHubAxis();
    });
    if (canvasRef.current) ro.observe(canvasRef.current);
    ro.observe(el);
    if (stage) ro.observe(stage);
    return () => ro.disconnect();
  }, [readSize, syncHubAxis]);

  return (
    <>
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
          position: desktopViewport ? 'static' : 'relative',
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
              left: hubAxisLeft,
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
              left: hubAxisLeft,
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
          {planAnchorSlot && !desktopViewport && (
            <div
              className="linkedin-dashboard-plan-anchor"
              style={{
                position: 'absolute',
                left: hubAxisLeft,
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

        {/* Mobile-only 2-column workflow grid */}
        <div className="linkedin-dashboard-mobile-workflow-wrap">
          <DashboardMobileWorkflowGrid onCardAction={onWorkflowCardAction} />
        </div>
      </div>

      {planAnchorSlot && desktopViewport && (
        <div className="linkedin-dashboard-plan-anchor linkedin-dashboard-plan-anchor--hub-bottom">
          {planAnchorSlot}
        </div>
      )}
    </>
  );
};
