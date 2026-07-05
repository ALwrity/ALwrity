import React from 'react';
import { createPortal } from 'react-dom';

interface DashboardActionModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  maxHeight?: string;
  zIndex?: number;
  disableClose?: boolean;
}

export const DashboardActionModal: React.FC<DashboardActionModalProps> = ({
  open,
  title,
  onClose,
  children,
  maxWidth = 720,
  maxHeight = 'min(90vh, 640px)',
  zIndex = 11000,
  disableClose = false,
}) => {
  if (!open) return null;

  const handleBackdropClose = () => {
    if (!disableClose) onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-action-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        padding: 24,
      }}
      onClick={handleBackdropClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e5e7eb',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <h2
            id="dashboard-action-modal-title"
            style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0a66c2', letterSpacing: '-0.01em' }}
          >
            {title}
          </h2>
          {!disableClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 18,
                lineHeight: 1,
                cursor: 'pointer',
                color: '#9ca3af',
                padding: '4px 8px',
                borderRadius: 6,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
};
