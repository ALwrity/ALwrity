import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LI_Z_KNOWLEDGE_CENTER } from '../../utils/linkedInStudioZIndex';
import {
  KNOWLEDGE_CENTER_FEATURES,
  type KnowledgeCenterFeature,
} from './knowledgeCenterFeatures';
import { FRAME_COLOR } from './dashboardWorkflowConfig';
import { DashboardRailIconButton } from './DashboardRailIconButton';
import { StudioModalCloseButton } from './StudioModalCloseButton';

export type KnowledgeCenterAction =
  | 'featureMap'
  | 'contentCoach'
  | 'persona'
  | 'bestPractices'
  | 'quickStart'
  | 'multimodal'
  | 'askAlwrity'
  // legacy — kept for backward compatibility
  | 'factCheck'
  | 'googleGround'
  | 'assistive'
  | 'copilot';

interface KnowledgeCenterDockProps {
  onFeatureAction: (action: KnowledgeCenterAction) => void;
  onExpandedChange?: (expanded: boolean) => void;
  variant?: 'main' | 'rail';
}

export const KnowledgeCenterDock: React.FC<KnowledgeCenterDockProps> = ({
  onFeatureAction,
  onExpandedChange,
  variant = 'main',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [gridPos, setGridPos] = useState<{ bottom: number; right: number; width: number } | null>(
    null
  );
  const anchorRef = useRef<HTMLDivElement>(null);
  const isRail = variant === 'rail';
  /** Always render inline in the rail — structural sidebar, not floating overlay */
  const useInlinePanel = !isRail;

  useEffect(() => {
    if (!expanded) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if ((event.target as Element).closest?.('.linkedin-knowledge-center-portal')) return;
      setExpanded(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [expanded]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  const updateGridPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(720, window.innerWidth - 32);
    const right = Math.max(16, window.innerWidth - rect.right);
    setGridPos({
      bottom: window.innerHeight - rect.top,
      right,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isRail || useInlinePanel || !expanded) {
      setGridPos(null);
      return;
    }
    updateGridPosition();
    window.addEventListener('resize', updateGridPosition);
    window.addEventListener('scroll', updateGridPosition, true);
    return () => {
      window.removeEventListener('resize', updateGridPosition);
      window.removeEventListener('scroll', updateGridPosition, true);
    };
  }, [isRail, useInlinePanel, expanded, updateGridPosition]);

  const handleFeatureClick = (feature: KnowledgeCenterFeature) => {
    onFeatureAction(feature.action);
    setExpanded(false);
  };

  const closePanel = () => setExpanded(false);

  const gridContent = (
    <div
      className="linkedin-knowledge-center-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))',
        gap: 8,
        padding: 10,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {KNOWLEDGE_CENTER_FEATURES.map((feature) => {
        const isHovered = hoveredId === feature.id;
        return (
          <button
            key={feature.id}
            type="button"
            onClick={() => handleFeatureClick(feature)}
            onMouseEnter={() => setHoveredId(feature.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 6px',
              background: '#ffffff',
              border: `2px solid ${FRAME_COLOR}`,
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'center',
              minWidth: 0,
              transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'none',
              boxShadow: isHovered
                ? `0 6px 18px ${feature.accent}33`
                : '0 2px 6px rgba(0,0,0,0.04)',
              transition: 'transform 160ms ease, box-shadow 160ms ease',
            }}
          >
            {feature.image ? (
              <img
                src={feature.image}
                alt={feature.title}
                style={{ width: 38, height: 28, objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: 22 }} aria-hidden>
                {feature.icon}
              </span>
            )}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: feature.accent,
                lineHeight: 1.2,
              }}
            >
              {feature.title}
            </span>
            <span
              style={{
                fontSize: 9,
                color: '#64748b',
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {feature.description}
            </span>
          </button>
        );
      })}
    </div>
  );

  const knowledgeCenterPanel = (
    <div className="linkedin-knowledge-center-panel">
      <div className="linkedin-knowledge-center-panel-header">
        <h3 className="linkedin-knowledge-center-panel-title">Knowledge Center</h3>
        <StudioModalCloseButton onClick={closePanel} ariaLabel="Close Knowledge Center" />
      </div>
      {gridContent}
    </div>
  );

  const triggerButton = (
    <DashboardRailIconButton
      label="Knowledge Center"
      icon="knowledge"
      onClick={() => setExpanded((open) => !open)}
      open={expanded}
      ariaExpanded={expanded}
    />
  );

  const portaledGrid =
    isRail &&
    !useInlinePanel &&
    expanded &&
    gridPos &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="linkedin-knowledge-center-portal"
        style={{
          position: 'fixed',
          bottom: gridPos.bottom,
          right: gridPos.right,
          width: gridPos.width,
          zIndex: LI_Z_KNOWLEDGE_CENTER,
          pointerEvents: 'auto',
          paddingBottom: 8,
          boxSizing: 'border-box',
        }}
      >
        {knowledgeCenterPanel}
      </div>,
      document.body
    );

  if (isRail) {
    return (
      <>
        {portaledGrid}
        <div ref={anchorRef} className="linkedin-knowledge-center-rail">
          {useInlinePanel && expanded && (
            <div className="linkedin-knowledge-center-inline" style={{ marginBottom: 8 }}>
              {knowledgeCenterPanel}
            </div>
          )}
          {triggerButton}
        </div>
      </>
    );
  }

  return (
    <div className="linkedin-knowledge-center-dock">
      <div ref={anchorRef} className="linkedin-knowledge-center-dock-inner">
        {expanded && <div style={{ marginBottom: 8 }}>{knowledgeCenterPanel}</div>}
        {triggerButton}
      </div>
    </div>
  );
};
