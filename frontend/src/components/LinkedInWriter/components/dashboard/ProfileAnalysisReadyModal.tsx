import React from 'react';
import { createPortal } from 'react-dom';
import { FRAME_COLOR } from './dashboardWorkflowConfig';
import { OptimiseProfileControl } from './OptimiseProfileControl';

interface ProfileAnalysisReadyModalProps {
  open: boolean;
  profileStrengthPercent: number;
  strengthLabel: string;
  actionPoints: string[];
  onOptimiseProfile: () => void;
  onDismiss: () => void;
  isOptimiseDisabled?: boolean;
}

export const ProfileAnalysisReadyModal: React.FC<ProfileAnalysisReadyModalProps> = ({
  open,
  profileStrengthPercent,
  strengthLabel,
  actionPoints,
  onOptimiseProfile,
  onDismiss,
  isOptimiseDisabled = false,
}) => {
  if (!open) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-analysis-ready-title"
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
          width: 'min(520px, 100%)',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 16,
          border: `2px solid ${FRAME_COLOR}`,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            background: FRAME_COLOR,
            borderBottom: `1px solid ${FRAME_COLOR}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <h2
            id="profile-analysis-ready-title"
            style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0a66c2' }}
          >
            Profile analysis ready
          </h2>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#475569',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '22px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Profile strength</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>
              {profileStrengthPercent}%
            </span>
            <span style={{ fontSize: 13, color: '#475569' }}>{strengthLabel}</span>
          </div>

          {actionPoints.length > 0 && (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                Action these first
              </p>
              <ul
                style={{
                  margin: '0 0 20px',
                  paddingLeft: 20,
                  color: '#475569',
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {actionPoints.map((point) => (
                  <li key={point} style={{ marginBottom: 6 }}>
                    {point}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <OptimiseProfileControl
              onOptimiseProfile={onOptimiseProfile}
              profileStrengthPercent={profileStrengthPercent}
              strengthLabel={strengthLabel}
              isDisabled={isOptimiseDisabled}
              variant="capsule"
            />
            <button
              type="button"
              onClick={onDismiss}
              style={{
                padding: '12px 18px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#64748b',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export function getProfileStrengthLabel(percent: number): string {
  if (percent >= 85) return 'Well optimised';
  if (percent >= 65) return 'Optimised (Needs more info)';
  return 'Needs improvement';
}

export function buildProfileActionPoints(
  missingFields: string[] = [],
  optionalMissing: string[] = [],
  fallbackTips: string[] = []
): string[] {
  const formatField = (field: string) =>
    field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const fromRequired = missingFields.slice(0, 3).map((f) => `Add your ${formatField(f)}`);
  const fromOptional = optionalMissing.slice(0, 2).map((f) => `Enhance ${formatField(f)}`);
  const combined = [...fromRequired, ...fromOptional];

  if (combined.length > 0) return combined.slice(0, 4);
  if (fallbackTips.length > 0) return fallbackTips.slice(0, 4);

  return [
    'Strengthen your headline for clearer positioning',
    'Expand your About section with outcomes and keywords',
    'Add skills that match your target audience',
  ];
}
