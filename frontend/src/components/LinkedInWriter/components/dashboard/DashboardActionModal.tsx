import React from 'react';
import { createPortal } from 'react-dom';
import { LI_Z_ELEVATED_MODAL, LI_Z_MODAL } from '../../utils/linkedInStudioZIndex';
import { StudioModalCloseButton } from './StudioModalCloseButton';

interface DashboardActionModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
  maxWidth?: number | string;
  height?: number | string;
  maxHeight?: string;
  minWidth?: number | string;
  minHeight?: number | string;
  zIndex?: number;
  disableClose?: boolean;
  /** Slightly larger title for primary wedge modals (e.g. Plan). */
  titleSize?: 'default' | 'lg';
  /** Text close control instead of ✕ (e.g. "Explore first"). */
  closeLabel?: string;
  /** Above studio tour / error overlays when set. */
  elevated?: boolean;
}

export const DashboardActionModal: React.FC<DashboardActionModalProps> = ({
  open,
  title,
  onClose,
  children,
  width,
  maxWidth = 720,
  height,
  maxHeight = 'min(90vh, 640px)',
  minWidth,
  minHeight,
  zIndex = LI_Z_MODAL,
  disableClose = false,
  titleSize = 'default',
  closeLabel,
  elevated = false,
}) => {
  if (!open) return null;

  const handleBackdropClose = () => {
    if (!disableClose) onClose();
  };

  const modalZIndex = elevated ? LI_Z_ELEVATED_MODAL : zIndex;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-action-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: modalZIndex,
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
          width: width ?? '100%',
          maxWidth,
          height,
          maxHeight,
          minWidth,
          minHeight,
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
            style={{ margin: 0, fontSize: titleSize === 'lg' ? 18 : 15, fontWeight: 700, color: '#0a66c2', letterSpacing: '-0.01em' }}
          >
            {title}
          </h2>
          {!disableClose && (
            closeLabel ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel ?? 'Close'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 13,
                  lineHeight: 1.2,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontWeight: 600,
                  transition: 'background 0.15s, color 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#0a66c2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                {closeLabel}
              </button>
            ) : (
              <StudioModalCloseButton onClick={onClose} ariaLabel="Close" />
            )
          )}
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
};
