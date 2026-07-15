import React, { useEffect, useState, useRef } from 'react';

interface EmailGenerationModalProps {
  isOpen: boolean;
  mode: 'personalize' | 'generate' | 'followup' | 'subjects';
  error?: string | null;
  onClose?: () => void;
}

const STEPS_BY_MODE: Record<string, { key: string; label: string }[]> = {
  personalize: [
    { key: 'context', label: 'Loading lead context & AI insights' },
    { key: 'analyze', label: 'Analyzing lead content & guidelines' },
    { key: 'craft', label: 'Crafting personalized email' },
    { key: 'finalize', label: 'Finalizing subject & body' },
  ],
  generate: [
    { key: 'topic', label: 'Analyzing pitch topic & target site' },
    { key: 'compose', label: 'Composing outreach email' },
    { key: 'finalize', label: 'Finalizing subject & body' },
  ],
  followup: [
    { key: 'context', label: 'Analyzing original email thread' },
    { key: 'compose', label: 'Composing follow-up message' },
    { key: 'finalize', label: 'Finalizing follow-up' },
  ],
  subjects: [
    { key: 'analyze', label: 'Analyzing email content' },
    { key: 'generate', label: 'Generating subject line variants' },
  ],
};

const EmailGenerationModal: React.FC<EmailGenerationModalProps> = ({
  isOpen,
  mode,
  error,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      return;
    }
    const steps = STEPS_BY_MODE[mode] || STEPS_BY_MODE.generate;
    timerRef.current = setInterval(() => {
      setStep((prev) => {
        if (prev >= steps.length - 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const steps = STEPS_BY_MODE[mode] || STEPS_BY_MODE.generate;
  const clamp = Math.min(step, steps.length);
  const pct = Math.min(100, Math.round((clamp / steps.length) * 100));
  const hasError = error !== null && error !== undefined;
  const allDone = step >= steps.length;
  const showClose = (hasError || allDone) && !!onClose;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '480px', maxWidth: '90vw',
        background: 'linear-gradient(135deg, #1a1a2e, #24243e)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '28px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{
            margin: 0, fontSize: '18px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {mode === 'personalize' ? 'Personalizing Email' :
             mode === 'followup' ? 'Generating Follow-up' :
             mode === 'subjects' ? 'Generating Subject Lines' :
             'Generating Email with AI'}
          </h3>
          {showClose && (
            <button onClick={onClose}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff',
                borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px',
              }}>
              Close
            </button>
          )}
        </div>

        <div style={{
          width: '100%', height: '6px', borderRadius: '3px',
          background: 'rgba(255,255,255,0.08)', marginBottom: '20px', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: hasError
              ? 'linear-gradient(90deg, #f5576c, #fa709a)'
              : 'linear-gradient(90deg, #667eea, #764ba2)',
            borderRadius: '3px',
            transition: 'width 0.5s ease',
          }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px',
                background: active ? 'rgba(102,126,234,0.1)' : 'transparent',
                opacity: done ? 0.6 : 1, marginBottom: '2px',
              }}>
                <span style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  background: done ? '#43e97b' : active ? '#667eea' : 'rgba(255,255,255,0.12)',
                  color: done || active ? '#fff' : 'rgba(255,255,255,0.4)',
                }}>
                  {done ? '✓' : active ? '→' : String(i + 1)}
                </span>
                <span style={{
                  fontSize: '13px',
                  color: done ? 'rgba(255,255,255,0.55)' : active ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontWeight: active ? 500 : 400,
                }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: '12px 14px', borderRadius: '8px',
          background: hasError ? 'rgba(245,87,108,0.1)' : 'rgba(255,255,255,0.04)',
          fontSize: '13px', color: hasError ? '#f5576c' : 'rgba(255,255,255,0.7)',
        }}>
          {hasError ? (
            <span>{error}</span>
          ) : allDone ? (
            <span style={{ color: '#43e97b' }}>Done! Applying generated content...</span>
          ) : (
            <span style={{ color: '#8b9cf7' }}>{steps[step]?.label || 'Working...'}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailGenerationModal;
