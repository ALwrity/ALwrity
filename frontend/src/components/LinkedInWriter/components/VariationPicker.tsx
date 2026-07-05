import React from 'react';

// ── Variation Result types + helpers ──────────────────────────────────────────
export interface VariationResult {
  label: string;
  toneIcon: string;
  content: string | null;
  error: string | null;
}

export function assembleFullContent(data: any): string {
  const content = data?.content || '';
  const hashtags = (data?.hashtags || []).map((h: any) =>
    typeof h === 'string' ? h : h?.hashtag || ''
  ).filter(Boolean).join(' ');
  const cta = data?.call_to_action || '';
  let full = content;
  if (hashtags) full += `\n\n${hashtags}`;
  if (cta) full += `\n\n${cta}`;
  return full;
}

const VARIATION_TONES = [
  { tone: '', label: 'Your Tone', toneIcon: '🎯' },
  { tone: 'conversational', label: 'Conversational', toneIcon: '💬' },
  { tone: 'inspirational', label: 'Inspirational', toneIcon: '🚀' },
];

// ── VariationPicker Component ─────────────────────────────────────────────────
interface VariationPickerProps {
  variations: VariationResult[];
  generating: boolean;
  onUse: (content: string) => void;
}

export const VariationPicker: React.FC<VariationPickerProps> = ({
  variations,
  generating,
  onUse,
}) => {
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null);
  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {generating ? (
          <>
            <div
              style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid #0a66c2', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Generating 3 tone variations — this may take a moment…
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
            Pick the best variation and send it to the editor
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(generating ? VARIATION_TONES : variations).map((v, i) => {
          const result = variations[i];
          const isLoading = generating;
          const hasContent = !isLoading && result?.content;
          const hasError = !isLoading && result?.error;
          const expanded = expandedIdx === i;
          return (
            <div
              key={i}
              style={{
                border: `1.5px solid ${hasContent ? '#bfdbfe' : '#e5e7eb'}`,
                borderRadius: 10,
                background: hasContent ? '#f8faff' : '#f9fafb',
                overflow: 'hidden',
                transition: 'border-color 180ms',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  cursor: hasContent ? 'pointer' : 'default',
                }}
                onClick={() => hasContent && setExpandedIdx(expanded ? null : i)}
              >
                <span style={{ fontSize: 16 }}>{v.toneIcon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', flex: 1 }}>
                  {v.label}
                </span>
                {isLoading && (
                  <div
                    style={{
                      width: 12, height: 12, borderRadius: '50%',
                      border: '2px solid #9ca3af', borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                )}
                {hasError && (
                  <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>Failed</span>
                )}
                {hasContent && (
                  <>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {expanded ? 'hide ▲' : 'preview ▼'}
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onUse(result.content!); }}
                      style={{
                        padding: '5px 12px',
                        border: 'none',
                        borderRadius: 6,
                        background: '#0a66c2',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Use this ✓
                    </button>
                  </>
                )}
              </div>
              {expanded && hasContent && (
                <div
                  style={{
                    padding: '0 12px 12px',
                    borderTop: '1px solid #e0e7ef',
                    maxHeight: 180,
                    overflowY: 'auto',
                    fontSize: 12,
                    color: '#334155',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {result.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
