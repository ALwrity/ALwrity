import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DashboardRadialWorkflow } from './DashboardRadialWorkflow';
import type { DashboardWorkflowCardId } from './dashboardWorkflowConfig';
import { computeRadialLayout } from './dashboardRadialLayout';

interface LinkedInDashboardHeroProps {
  children: React.ReactNode;
  onWorkflowCardAction: (cardId: DashboardWorkflowCardId) => void;
}

export const LinkedInDashboardHero: React.FC<LinkedInDashboardHeroProps> = ({
  children,
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

  return (
    <div
      ref={containerRef}
      className="linkedin-dashboard-hero"
      style={{
        width: '100%',
        flex: 1,
        minHeight: 280,
        flexShrink: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
        position: 'relative',
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
        <div
          className="linkedin-dashboard-hero-hub"
          style={{
            position: 'absolute',
            left: '50%',
            top: layout.centerY + layout.hubOffsetY,
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            width: '100%',
            maxWidth: Math.max(220, layout.innerR * 2.4),
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
      </div>
    </div>
  );
};
