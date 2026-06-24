import React from 'react';

interface LoadingIndicatorProps {
  isGenerating: boolean;
  loadingMessage: string;
  currentAction: string | null;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isGenerating,
  loadingMessage,
  currentAction
}) => {
  if (!isGenerating) return null;

  return (
    <div style={{
      marginBottom: '20px',
      padding: '16px 20px',
      background: 'rgba(255,255,255,0.7)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      border: '1px solid rgba(10,102,194,0.08)',
      borderRadius: '10px',
      textAlign: 'center'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '6px'
      }}>
        <div style={{
          width: '18px',
          height: '18px',
          border: '2px solid #e2e8f0',
          borderTop: '2px solid #0a66c2',
          borderRadius: '50%',
          animation: 'liSpin 1s linear infinite',
          flexShrink: 0
        }} />
        <div style={{
          color: '#0f172a',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {loadingMessage || 'Generating content...'}
        </div>
      </div>
      <div style={{
        fontSize: '12px',
        color: '#94a3b8',
        lineHeight: '1.5'
      }}>
        This typically takes 30-60 seconds. We are researching, writing, and optimizing your content with source citations.
      </div>
      <style>{`
        @keyframes liSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingIndicator;
