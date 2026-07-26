import React from 'react';
import { createPortal } from 'react-dom';
import { Box, Button, Typography } from '@mui/material';
import { AlwrityModalCloseIconButton } from './AlwrityModalCloseIconButton';

interface UserConfirmModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel?: string;
  confirming?: boolean;
  confirmDisabled?: boolean;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}

/** Studio-style confirmation modal shared by UserBadge destructive actions. */
export const UserConfirmModal: React.FC<UserConfirmModalProps> = ({
  open,
  title,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirming = false,
  confirmDisabled = false,
  variant = 'default',
  children,
}) => {
  if (!open) return null;

  const titleColor = variant === 'danger' ? '#991b1b' : '#0a66c2';
  const confirmBg = variant === 'danger' ? '#991b1b' : '#0a66c2';
  const confirmHoverBg = variant === 'danger' ? '#7f1d1d' : '#084a8a';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-confirm-modal-title"
      className="linkedin-dashboard-action-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="linkedin-dashboard-action-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
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
          }}
        >
          <Typography
            id="user-confirm-modal-title"
            component="h2"
            sx={{ m: 0, fontSize: 15, fontWeight: 700, color: titleColor, letterSpacing: '-0.01em', flex: 1, minWidth: 0 }}
          >
            {title}
          </Typography>
          <AlwrityModalCloseIconButton onClick={onClose} ariaLabel="Close dialog" />
        </div>
        <div style={{ padding: 20 }}>{children}</div>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            px: 2.5,
            pb: 2,
            pt: 0,
          }}
        >
          <Button onClick={onClose} sx={{ color: '#6b7280' }}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            disabled={confirmDisabled || confirming}
            sx={{ bgcolor: confirmBg, '&:hover': { bgcolor: confirmHoverBg } }}
          >
            {confirming ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </Box>
      </div>
    </div>,
    document.body,
  );
};
