import React, { useMemo } from 'react';
import CircularProgress from '@mui/material/CircularProgress';

interface PublishProgressModalProps {
  open: boolean;
  platform: string;
  currentStage: number;
  error?: string | null;
  done: boolean;
  onClose: () => void;
}

type StageState = 'upcoming' | 'active' | 'done' | 'error';

const stageStateStyle: Record<StageState, { background: string; border: string; color: string }> = {
  upcoming: { background: '#f1f5f9', border: '#e2e8f0', color: '#94a3b8' },
  active: { background: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  done: { background: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
  error: { background: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
};

const stageDefinitions = [
  { id: 'validating', label: 'Validating', icon: '🔍', description: 'Checking SEO metadata and content' },
  { id: 'connecting', label: 'Connecting', icon: '🔗', description: `Connecting to platform API` },
  { id: 'publishing', label: 'Publishing', icon: '📤', description: 'Sending content to platform' },
  { id: 'complete', label: 'Complete', icon: '✅', description: 'Publish finished' },
];

const platformLogos: Record<string, string> = {
  wordpress: '🔵',
  wix: '🟣',
};

const PublishProgressModal: React.FC<PublishProgressModalProps> = ({
  open,
  platform,
  currentStage,
  error,
  done,
  onClose,
}) => {
  const stagesWithState = useMemo(() => {
    return stageDefinitions.map((stage, i) => {
      let state: StageState = 'upcoming';
      if (error) {
        state = i === currentStage ? 'error' : i < currentStage ? 'done' : 'upcoming';
      } else if (done) {
        state = 'done';
      } else if (i < currentStage) {
        state = 'done';
      } else if (i === currentStage) {
        state = 'active';
      }
      return { ...stage, state };
    });
  }, [currentStage, error, done]);

  const progressPct = useMemo(() => {
    if (error) return 0;
    if (done) return 100;
    const doneCount = stagesWithState.filter(s => s.state === 'done').length;
    const activeCount = stagesWithState.filter(s => s.state === 'active').length;
    return Math.round(((doneCount + activeCount * 0.5) / stageDefinitions.length) * 100);
  }, [stagesWithState, error, done]);

  if (!open) return null;

  const headerBg = error ? '#fef2f2' : done ? '#ecfdf5' : '#eff6ff';
  const headerBorder = error ? '#fecaca' : done ? '#bbf7d0' : '#bfdbfe';
  const headerText = error ? '#b91c1c' : done ? '#047857' : '#1d4ed8';
  const statusLabel = error ? 'Failed' : done ? 'Published!' : 'Publishing...';

  const platformLabel = platform === 'wordpress' ? 'WordPress' : 'Wix';
  const platformIcon = platformLogos[platform] || '🌐';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
      }}
      onClick={done || error ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          maxWidth: 520,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          border: '1px solid rgba(148,163,184,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: headerBg,
            borderBottom: `1px solid ${headerBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{platformIcon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                Publishing to {platformLabel}
              </div>
              <div style={{ fontSize: '0.8rem', color: headerText, fontWeight: 500 }}>
                {statusLabel}
              </div>
            </div>
          </div>
          {(done || error) && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#64748b',
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {/* Thin progress bar */}
          {!error && !done && (
            <div
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: '#e5e7eb',
                overflow: 'hidden',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          )}

          {/* Stage chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {stagesWithState.map((stage) => {
              const style = stageStateStyle[stage.state];
              return (
                <div
                  key={stage.id}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 10,
                    backgroundColor: style.background,
                    border: `1px solid ${style.border}`,
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    animation: stage.state === 'active' ? 'publishPulse 2s ease-in-out infinite' : undefined,
                  }}
                >
                  <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 2 }}>
                    {stage.state === 'active' && !error ? (
                      <CircularProgress size={16} thickness={5} sx={{ color: '#1d4ed8' }} />
                    ) : (
                      stage.icon
                    )}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.6rem',
                      color: style.color,
                      lineHeight: 1.2,
                    }}
                  >
                    {stage.state === 'active' ? 'Working…' : stage.state === 'done' ? 'Done' : stage.state === 'error' ? 'Error' : stage.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status message */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}
          {done && !error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#ecfdf5',
                border: '1px solid #bbf7d0',
                color: '#047857',
                fontSize: '0.85rem',
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              Successfully published to {platformLabel}!
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes publishPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.15); }
          50% { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
        }
      `}</style>
    </div>
  );
};

export default PublishProgressModal;
