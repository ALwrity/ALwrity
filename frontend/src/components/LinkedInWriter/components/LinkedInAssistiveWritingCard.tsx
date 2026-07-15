import React from 'react';
import type { LinkedInAssistiveSuggestion } from '../services/linkedInAssistiveWritingApi';

interface LinkedInAssistiveWritingCardProps {
  enabled: boolean;
  suggestion: LinkedInAssistiveSuggestion | null;
  error: string | null;
  isGenerating: boolean;
  showContinuePrompt: boolean;
  suggestionIndex: number;
  totalSuggestions: number;
  onAccept: () => void;
  onReject: () => void;
  onNext: () => void;
  onContinueWriting: () => void;
  onDismiss: () => void;
}

const LinkedInAssistiveWritingCard: React.FC<LinkedInAssistiveWritingCardProps> = ({
  enabled,
  suggestion,
  error,
  isGenerating,
  showContinuePrompt,
  suggestionIndex,
  totalSuggestions,
  onAccept,
  onReject,
  onNext,
  onContinueWriting,
  onDismiss,
}) => {
  if (!enabled || (!suggestion && !error && !showContinuePrompt && !isGenerating)) {
    return null;
  }

  const primaryBtn = {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #0a66c2',
    background: '#0a66c2',
    color: '#fff',
    fontSize: 12,
    minWidth: '80px',
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
  };

  const secondaryBtn = {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #ddd',
    background: '#fff',
    color: '#555',
    fontSize: 12,
    minWidth: '80px',
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        width: '100%',
        zIndex: 1000,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
      }}
    >
      {isGenerating ? (
        <>
          <strong style={{ color: '#0a66c2' }}>Assistive Writing</strong>
          <div style={{ fontSize: 14, color: '#666', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 14,
                height: 14,
                border: '2px solid #e1f5fe',
                borderTop: '2px solid #0a66c2',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'li-spin 1s linear infinite',
              }}
            />
            Researching and drafting a suggestion...
          </div>
          <style>{`@keyframes li-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </>
      ) : error ? (
        <>
          <strong style={{ color: '#d32f2f' }}>Assistive Writing Error</strong>
          <div style={{ fontSize: 14, color: '#d32f2f', margin: '8px 0' }}>{error}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onDismiss} style={{ ...primaryBtn, borderColor: '#d32f2f', background: '#d32f2f' }}>
              Dismiss
            </button>
            {showContinuePrompt && (
              <button type="button" onClick={onContinueWriting} style={secondaryBtn}>
                Try again
              </button>
            )}
          </div>
        </>
      ) : showContinuePrompt ? (
        <>
          <strong style={{ color: '#0a66c2' }}>Assistive Writing</strong>
          <div style={{ fontSize: 14, color: '#333', margin: '8px 0' }}>
            ALwrity can contextually continue writing. Click Continue writing when you are ready.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onContinueWriting} style={primaryBtn}>
              Continue writing
            </button>
            <button type="button" onClick={onDismiss} style={secondaryBtn}>
              Dismiss
            </button>
          </div>
        </>
      ) : suggestion ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ color: '#0a66c2' }}>Assistive Writing Suggestion</strong>
            <span style={{ fontSize: 12, color: '#999' }}>
              Confidence: {Math.round((suggestion.confidence || 0) * 100)}%
            </span>
          </div>
          <div style={{ fontSize: 14, color: '#333', marginBottom: 8 }}>{suggestion.text}</div>
          {suggestion.sources?.length > 0 && (
            <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {suggestion.sources.slice(0, 3).map((source, index) => (
                <a
                  key={`${source.url}-${index}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#0a66c2', textDecoration: 'none' }}
                >
                  {source.title || 'Source'}
                </a>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onAccept} style={primaryBtn}>
              Accept
            </button>
            <button type="button" onClick={onReject} style={secondaryBtn}>
              Dismiss
            </button>
            {totalSuggestions > 1 && suggestionIndex < totalSuggestions - 1 && (
              <button type="button" onClick={onNext} style={secondaryBtn}>
                Next ({suggestionIndex + 1}/{totalSuggestions})
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default LinkedInAssistiveWritingCard;
