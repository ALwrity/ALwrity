import React from 'react';
import { createPortal } from 'react-dom';
import type { LinkedInProfileAnalysisError } from '../../../../api/linkedinSocial';
import { FRAME_COLOR } from './dashboardWorkflowConfig';

interface DashboardErrorModalProps {
  open: boolean;
  error: LinkedInProfileAnalysisError;
  onRetry?: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
  title?: string;
}

export const DashboardErrorModal: React.FC<DashboardErrorModalProps> = ({
  open,
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
  title = 'Something went wrong',
}) => {
  if (!open) return null;

  const modalContent = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dashboard-error-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 13000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.5)',
        padding: 20,
      }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(460px, 100%)',
          maxWidth: 420,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          background: '#fffbeb',
          borderRadius: 14,
          border: '2px solid #fde68a',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #fde68a',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h2
            id="dashboard-error-title"
            style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#92400e' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              color: '#78716c',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '16px 18px', color: '#92400e' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14, lineHeight: 1.45 }}>
            {error.user_message}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#b45309' }}>
            Failed at Phase {error.failed_phase}: {error.phase_label} ({error.error_code})
          </p>
          {process.env.NODE_ENV === 'development' && error.debug_message && (
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 11,
                color: '#78716c',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                lineHeight: 1.4,
              }}
            >
              {error.debug_message}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid #f59e0b',
                  backgroundColor: '#fff',
                  color: '#92400e',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isRetrying ? 'default' : 'pointer',
                  opacity: isRetrying ? 0.7 : 1,
                }}
              >
                {isRetrying ? 'Retrying…' : 'Retry'}
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
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
