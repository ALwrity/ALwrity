import React from 'react';

const steps = [
  { key: 'scrape', label: 'Scraping page content for each opportunity' },
  { key: 'analyze', label: 'Analyzing site with AI for guest post signals' },
  { key: 'contact', label: 'Extracting editor names and contact info' },
  { key: 'relevance', label: 'Scoring relevance to your search keyword' },
  { key: 'flags', label: 'Identifying risk flags and red flags' },
  { key: 'pitch', label: 'Generating personalized pitch angles' },
];

interface AiProspectModalProps {
  isOpen: boolean;
  currentStep?: number;
  progressLabel?: string;
  totalOpportunities: number;
  onClose?: () => void;
}

const AiProspectModal: React.FC<AiProspectModalProps> = ({
  isOpen,
  currentStep = 0,
  progressLabel,
  totalOpportunities,
  onClose,
}) => {
  if (!isOpen) return null;

  const clamp = Math.min(currentStep, steps.length);
  const pct = totalOpportunities > 0
    ? Math.min(100, Math.round((clamp / (steps.length + 0.5)) * 100))
    : 0;

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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Prospecting
          </h3>
          {currentStep >= steps.length && onClose && (
            <button onClick={onClose}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff',
                borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px',
              }}>
              Close
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%', height: '6px', borderRadius: '3px',
          background: 'rgba(255,255,255,0.08)', marginBottom: '20px', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: 'linear-gradient(90deg, #667eea, #764ba2)',
            borderRadius: '3px',
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Step list */}
        <div style={{ marginBottom: '16px' }}>
          {steps.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={step.key} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px',
                background: active ? 'rgba(102,126,234,0.1)' : 'transparent',
                opacity: done ? 0.6 : 1,
                marginBottom: '2px',
              }}>
                {/* Icon */}
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
                  fontSize: '13px', color: done ? 'rgba(255,255,255,0.55)' : active ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontWeight: active ? 500 : 400,
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom status */}
        <div style={{
          padding: '12px 14px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          fontSize: '13px', color: 'rgba(255,255,255,0.7)',
        }}>
          {currentStep >= steps.length ? (
            <span style={{ color: '#43e97b' }}>AI analysis complete for {totalOpportunities} opportunities. Results shown on opportunity cards.</span>
          ) : (
            <>
              <span style={{ color: '#8b9cf7' }}>{progressLabel || `Processing opportunity ${clamp} of ~${totalOpportunities}...`}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiProspectModal;
