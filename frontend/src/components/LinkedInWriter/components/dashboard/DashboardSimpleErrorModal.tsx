import React from 'react';
import { createPortal } from 'react-dom';
import { FRAME_COLOR } from './dashboardWorkflowConfig';

interface DashboardSimpleErrorModalProps {
  open: boolean;
  message: string;
  title?: string;
  onClose: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const DashboardSimpleErrorModal: React.FC<DashboardSimpleErrorModalProps> = ({
  open,
  message,
  title = 'Something went wrong',
  onClose,
  onRetry,
  isRetrying = false,
}) => {
  if (!open || !message) return null;

  const modalContent = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dashboard-simple-error-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 13000,
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
          maxWidth: 480,
          maxHeight: 'min(90vh, 420px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 16,
          border: '2px solid #fecaca',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #fecaca',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <h2
            id="dashboard-simple-error-title"
            style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#b91c1c' }}
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
              color: '#64748b',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <p style={{ margin: 0, color: '#334155', fontSize: 14, lineHeight: 1.55 }}>{message}</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#0a66c2',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isRetrying ? 'default' : 'pointer',
                  opacity: isRetrying ? 0.7 : 1,
                }}
              >
                {isRetrying ? 'Retrying…' : 'Try again'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                border: `1px solid ${FRAME_COLOR}`,
                backgroundColor: '#fff',
                color: '#475569',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
