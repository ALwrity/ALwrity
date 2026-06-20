import React, { useEffect, useMemo, useRef } from 'react';
import CircularProgress from '@mui/material/CircularProgress';

interface OutlineProgressModalProps {
  isVisible: boolean;
  status: string;
  progressMessages: string[];
  latestMessage: string;
  error: string | null;
  titleOverride?: string;
  onClose?: () => void;
}

type Tone = 'info' | 'active' | 'success' | 'warning' | 'error';
type StageState = 'upcoming' | 'active' | 'done' | 'error';

const toneStyles: Record<Tone, { bg: string; border: string; text: string }> = {
  info: { bg: '#f8fafc', border: '#e2e8f0', text: '#0f172a' },
  active: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  success: { bg: '#ecfdf5', border: '#bbf7d0', text: '#047857' },
  warning: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
};

const stageDefinitions = [
  {
    id: 'starting',
    label: 'Starting',
    icon: '🚀',
    keywords: ['Starting outline generation', 'Alwrity is preparing', 'preparing your blog']
  },
  {
    id: 'research-analysis',
    label: 'Analysis',
    icon: '📊',
    keywords: ['Analyzing research', 'content strategy', 'Packaging your outline']
  },
  {
    id: 'generation',
    label: 'Generation',
    icon: '🤖',
    keywords: ['Generating AI', 'Making AI request', 'Calling', 'AI is crafting', 'AI is writing']
  },
  {
    id: 'processing',
    label: 'Processing',
    icon: '⚙️',
    keywords: ['Processing outline', 'Running parallel', 'Polishing content']
  },
  {
    id: 'mapping',
    label: 'Source Mapping',
    icon: '🔗',
    keywords: ['Applying intelligent source', 'Extracting grounding', 'Enhancing sections', 'Found existing content']
  },
  {
    id: 'optimization',
    label: 'Optimizing',
    icon: '🎯',
    keywords: ['Optimizing outline', 'Rebalancing word']
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: '✅',
    keywords: ['completed successfully', 'generated successfully', 'generation complete']
  }
];

const contentStageDefinitions = [
  {
    id: 'preparing',
    label: 'Preparing',
    icon: '⏳',
    keywords: ['preparing your blog', 'Packaging your outline']
  },
  {
    id: 'cache',
    label: 'Cache Check',
    icon: '⚡',
    keywords: ['Found existing content']
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: '✍️',
    keywords: ['AI is writing', 'Generating AI', 'Making AI request', 'Calling']
  },
  {
    id: 'polishing',
    label: 'Polishing',
    icon: '✨',
    keywords: ['Polishing content']
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: '✅',
    keywords: ['generation complete', 'complete!']
  }
];

const statusThemes: Record<
  string,
  { label: string; color: string; background: string; description: string }
> = {
  idle: { label: 'Preparing', description: 'Starting up…', color: '#1f2937', background: '#e5e7eb' },
  pending: { label: 'Queued', description: 'Waiting for backend…', color: '#1f2937', background: '#e5e7eb' },
  running: { label: 'In Progress', description: 'Generating…', color: '#1d4ed8', background: '#dbeafe' },
  completed: { label: 'Complete', description: 'Ready to review', color: '#047857', background: '#d1fae5' },
  success: { label: 'Complete', description: 'Ready to review', color: '#047857', background: '#d1fae5' },
  failed: { label: 'Needs Attention', description: 'Something went wrong', color: '#b91c1c', background: '#fee2e2' }
};

const stageStateCopy: Record<StageState, { background: string; border: string; color: string }> = {
  upcoming: { background: '#f1f5f9', border: '#e2e8f0', color: '#94a3b8' },
  active: { background: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  done: { background: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
  error: { background: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
};

function getStageStateFromMessage(
  message: string,
  stages: typeof stageDefinitions,
  completeIndex: number
): StageState {
  const msgLower = message.toLowerCase();
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].keywords.some(kw => msgLower.includes(kw.toLowerCase()))) {
      if (i < completeIndex) return 'done';
      if (i === completeIndex) return 'active';
      return 'upcoming';
    }
  }
  return 'upcoming';
}

export const OutlineProgressModal: React.FC<OutlineProgressModalProps> = ({
  isVisible,
  status,
  progressMessages,
  latestMessage,
  error,
  titleOverride,
  onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const isContentGen = !!titleOverride;
  const stages = isContentGen ? contentStageDefinitions : stageDefinitions;
  const isRunning = status === 'running' || status === 'pending';
  const isComplete = status === 'completed' || status === 'success';
  const isFailed = status === 'failed' || !!error;

  const statusInfo = statusThemes[status] || statusThemes.running;

  const latestStageIndex = useMemo(() => {
    if (progressMessages.length === 0) return -1;
    const lastMsg = progressMessages[progressMessages.length - 1] || '';
    const msgLower = lastMsg.toLowerCase();
    for (let i = stages.length - 1; i >= 0; i--) {
      if (stages[i].keywords.some(kw => msgLower.includes(kw.toLowerCase()))) {
        return i;
      }
    }
    return -1;
  }, [progressMessages, stages]);

  const stagesWithState = useMemo(() => {
    return stages.map((stage, i) => {
      let state: StageState = 'upcoming';
      if (isFailed) {
        state = i === stages.length - 1 ? 'error' : 'done';
      } else if (isComplete) {
        state = 'done';
      } else if (latestStageIndex === -1) {
        state = i === 0 ? 'active' : 'upcoming';
      } else if (i < latestStageIndex) {
        state = 'done';
      } else if (i === latestStageIndex) {
        state = 'active';
      }
      return { ...stage, state };
    });
  }, [stages, latestStageIndex, isComplete, isFailed]);

  const progressPct = useMemo(() => {
    if (isComplete) return 100;
    if (isFailed) return 0;
    const done = stagesWithState.filter(s => s.state === 'done').length;
    const active = stagesWithState.filter(s => s.state === 'active').length;
    if (done === 0 && active === 0) return 0;
    return Math.round(((done + active * 0.5) / stages.length) * 100);
  }, [stagesWithState, isComplete, isFailed, stages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [progressMessages]);

  if (!isVisible) return null;

  const closeable = isComplete || isFailed;

  return (
    <>
      <style>{`
        @keyframes outlinePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.15); }
          50% { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '24px'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 700,
            maxHeight: '85vh',
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Compact header */}
          <div
            style={{
              padding: '16px 20px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              {isRunning && <CircularProgress size={18} thickness={4} sx={{ color: '#2563eb', flexShrink: 0 }} />}
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
                  {isContentGen
                    ? (isComplete ? 'Content Ready' : isFailed ? 'Generation Failed' : 'Generating Content')
                    : (isComplete ? 'Outline Ready' : isFailed ? 'Outline Failed' : 'Generating Outline')}
                </h3>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: statusInfo.background,
                    color: statusInfo.color,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  {statusInfo.label}
                  {statusInfo.description && (
                    <span style={{ fontWeight: 400, fontSize: 11, color: '#64748b' }}>
                      — {statusInfo.description}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {closeable && onClose && (
              <button
                onClick={onClose}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#475569',
                  flexShrink: 0
                }}
              >
                Close
              </button>
            )}
          </div>

          <div style={{ padding: '12px 20px', overflow: 'auto', flex: 1 }}>
            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: '100%',
                    borderRadius: 2,
                    background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                {stagesWithState.filter(s => s.state === 'done').length}/{stages.length}
              </span>
            </div>

            {/* Compact stage indicators */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {stagesWithState.map(stage => {
                const copy = stageStateCopy[stage.state];
                return (
                  <div
                    key={stage.id}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: 8,
                      background: copy.background,
                      border: `1px solid ${copy.border}`,
                      textAlign: 'center',
                      animation: stage.state === 'active' ? 'outlinePulse 2s ease-in-out infinite' : undefined,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ fontSize: 16, lineHeight: 1 }}>{stage.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: copy.color, marginTop: 2, lineHeight: 1.2 }}>
                      {stage.state === 'active' ? 'Working…' : stage.state === 'done' ? 'Done' : stage.state === 'error' ? 'Error' : stage.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error display */}
            {error && (
              <div
                style={{
                  marginBottom: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 13
                }}
              >
                {error.includes('You do not have access')
                  ? 'You do not have access to the blog writer. Please check your subscription or account permissions.'
                  : error.includes('balance')
                    ? 'Your API balance is insufficient. Please top up your account or switch to a different provider.'
                    : error}
              </div>
            )}

            {/* Latest message card — compact */}
            {latestMessage && !error && (
              <div
                style={{
                  borderRadius: 10,
                  padding: '10px 14px',
                  border: `1px solid ${isComplete ? '#bbf7d0' : '#bfdbfe'}`,
                  background: isComplete ? '#ecfdf5' : '#eff6ff',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <div style={{ fontSize: 20, flexShrink: 0 }}>
                  {isComplete ? '✅' : isRunning ? '⏳' : 'ℹ️'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isRunning && (
                      <CircularProgress size={12} thickness={5} sx={{ color: '#1d4ed8', flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {latestMessage}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable message log — compact rows */}
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                maxHeight: '28vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div
                ref={scrollRef}
                style={{
                  overflowY: 'auto',
                  padding: '6px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                {progressMessages.length === 0 && (
                  <div style={{ padding: '8px 0', color: '#9ca3af', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isRunning && <CircularProgress size={10} thickness={5} sx={{ color: '#9ca3af' }} />}
                    Awaiting progress updates…
                  </div>
                )}
                {progressMessages.map((msg, index) => {
                  const msgLower = msg.toLowerCase();
                  let tone: Tone = 'info';
                  if (isComplete && index === progressMessages.length - 1) tone = 'success';
                  else if (msgLower.includes('complete') || msgLower.includes('success')) tone = 'success';
                  else if (msgLower.includes('error') || msgLower.includes('fail')) tone = 'error';
                  else if (index === progressMessages.length - 1) tone = 'active';
                  const styles = toneStyles[tone];
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: styles.bg,
                        border: `1px solid ${styles.border}`,
                        fontSize: 12
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }}>
                        {tone === 'success' ? '✅' : tone === 'error' ? '❌' : tone === 'active' ? '⚡' : '📋'}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: styles.text,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {msg}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OutlineProgressModal;
