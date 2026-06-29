import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FRAME_COLOR } from './dashboardWorkflowConfig';

interface DashboardActionModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

export const DashboardActionModal: React.FC<DashboardActionModalProps> = ({
  open,
  title,
  onClose,
  children,
  maxWidth = 720,
}) => {
  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-action-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.45)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'min(90vh, 640px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          border: `2px solid ${FRAME_COLOR}`,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${FRAME_COLOR}`,
            background: FRAME_COLOR,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <h2
            id="dashboard-action-modal-title"
            style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0a66c2' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              color: '#475569',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
};
