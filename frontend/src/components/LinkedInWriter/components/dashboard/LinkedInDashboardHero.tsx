import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DashboardRadialWorkflow } from './DashboardRadialWorkflow';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import {
  computeRadialLayout,
  layoutHubCenterLeftCss,
  layoutHubCenterY,
  ringSpotlightDiameter,
} from './dashboardRadialLayout';
import { DashboardMobileWorkflowGrid } from './DashboardMobileWorkflowGrid';
import { DashboardMobileAnalyticsSection } from './DashboardMobileAnalyticsSection';
import type { KnowledgeCenterAction } from './KnowledgeCenterDock';
import { useDesktopViewport } from '../../hooks/useDesktopViewport';
import { HUB_CENTER_LEFT_CSS_VAR } from './dashboardLayoutConstants';

interface LinkedInDashboardHeroProps {
  children: React.ReactNode;
  planAnchorSlot?: React.ReactNode;
  onWorkflowCardAction: (cardId: DashboardWorkflowCardId) => void;
  onViewAnalytics?: () => void;
  onKnowledgeCenterAction?: (action: KnowledgeCenterAction) => void;
  mobileProfileHubSlot?: React.ReactNode;
  mobileContextNudgeSlot?: React.ReactNode;
  mobileStudioActionsSlot?: React.ReactNode;
}

export const LinkedInDashboardHero: React.FC<LinkedInDashboardHeroProps> = ({
  children,
  planAnchorSlot,
  onWorkflowCardAction,
  onViewAnalytics,
  onKnowledgeCenterAction,
  mobileProfileHubSlot,
  mobileContextNudgeSlot,
  mobileStudioActionsSlot,
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
  const ringCenterTop = layoutHubCenterY(layout);
  const hubCenterLeft = layoutHubCenterLeftCss(layout);
  const hubAxisLeft = desktopViewport ? `var(${HUB_CENTER_LEFT_CSS_VAR})` : hubCenterLeft;
  const lifecycleSpotlightSize = desktopViewport ? ringSpotlightDiameter(layout.outerR) : 0;
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

  const mobileWorkflowGrid = (
    <div className="linkedin-dashboard-mobile-workflow-wrap">
      <DashboardMobileWorkflowGrid
        onCardAction={onWorkflowCardAction}
        profileHubSlot={mobileProfileHubSlot}
        contextNudgeSlot={mobileContextNudgeSlot}
        studioActionsSlot={mobileStudioActionsSlot}
      />
    </div>
  );
  const profileRelocatedToWorkflowHeader = !desktopViewport && Boolean(mobileProfileHubSlot);

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
        {!desktopViewport && mobileWorkflowGrid}

        <div
          ref={canvasRef}
          className={`linkedin-dashboard-hero-canvas${
            desktopViewport ? '' : ' linkedin-dashboard-hero-canvas--mobile'
          }${
            profileRelocatedToWorkflowHeader
              ? ' linkedin-dashboard-hero-canvas--profile-relocated'
              : ''
          }`}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '100%',
            height: desktopViewport ? layout.viewH : 'auto',
            flexShrink: 0,
            zIndex: 1,
          }}
        >
          {desktopViewport && (
            <>
              <DashboardRadialWorkflow layout={layout} onCardAction={onWorkflowCardAction} />
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
            </>
          )}
          <div
            className="linkedin-dashboard-hero-hub"
            style={{
              position: desktopViewport ? 'absolute' : 'relative',
              left: desktopViewport ? hubAxisLeft : 'auto',
              top: desktopViewport ? hubTop : 'auto',
              transform: desktopViewport ? 'translate(-50%, -50%)' : 'none',
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
              margin: desktopViewport ? undefined : '0 auto',
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
                position: 'relative',
                left: 'auto',
                top: 'auto',
                transform: 'none',
                zIndex: 20,
                pointerEvents: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: 0,
                marginTop: 6,
              }}
            >
              {planAnchorSlot}
            </div>
          )}
        </div>

        {!desktopViewport && onViewAnalytics && onKnowledgeCenterAction && (
          <DashboardMobileAnalyticsSection
            onViewAnalytics={onViewAnalytics}
            onKnowledgeCenterAction={onKnowledgeCenterAction}
          />
        )}
      </div>

      {planAnchorSlot && desktopViewport && (
        <div className="linkedin-dashboard-plan-anchor linkedin-dashboard-plan-anchor--hub-bottom">
          {planAnchorSlot}
        </div>
      )}
    </>
  );
};
