/**
 * Manual paste → Generate Reply (existing Comment Assistant flow).
 * Kept as the Manual tab so creators can draft without inbox sync.
 */
import React, { useEffect, useState } from 'react';
import {
  linkedInWriterApi,
  type LinkedInCommentResponseRequest,
} from '../../../../services/linkedInWriterApi';
import { colors, rowBase } from '../GrowthEngine/styles';
import { COMMENT_ASSISTANT_MANUAL_INTRO } from './commentAssistantCopy';

const DRAFT_KEY = 'alwrity-copilot-draft-content';

const RESPONSE_TYPES = [
  { value: 'professional', label: 'Professional' },
  { value: 'appreciative', label: 'Appreciative' },
  { value: 'value_add', label: 'Add Value' },
  { value: 'clarifying', label: 'Clarifying' },
  { value: 'disagreement', label: 'Respectful Pushback' },
] as const;

function readDraft(): string {
  try { return localStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
}

function pushDraftToStudio(text: string) {
  window.dispatchEvent(new CustomEvent('linkedinwriter:updateDraft', { detail: text }));
}

function textareaStyle(minH: number): React.CSSProperties {
  return {
    width: '100%',
    minHeight: minH,
    padding: '9px 11px',
    borderRadius: 8,
    border: `1.5px solid ${colors.border}`,
    fontSize: 12,
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    color: colors.textBody,
    boxSizing: 'border-box',
    marginBottom: 10,
  };
}

const Spinner = () => (
  <>
    <style>{`@keyframes ca-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        border: '2px solid #d1d5db',
        borderTopColor: colors.primary,
        borderRadius: '50%',
        animation: 'ca-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  </>
);

const FieldLabel: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMedium, marginBottom: 5 }}>{label}</div>
);

const AltReplyRow: React.FC<{ text: string; onCopy: (t: string) => void; onUse: () => void }> = ({
  text,
  onCopy,
  onUse,
}) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ ...rowBase, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: colors.textBody, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 8 }}>
        {text}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={copy}
          style={{
            padding: '4px 10px',
            background: copied ? '#dcfce7' : colors.badgeBg,
            color: copied ? '#166534' : colors.textSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: 5,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {copied ? '✓' : '📋'} Copy
        </button>
        <button
          type="button"
          onClick={onUse}
          style={{
            padding: '4px 10px',
            background: 'none',
            border: `1px solid ${colors.primary}`,
            borderRadius: 5,
            fontSize: 11,
            color: colors.primary,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Edit in Studio
        </button>
      </div>
    </div>
  );
};

interface CommentAssistantManualPanelProps {
  active: boolean;
  onClose: () => void;
}

export const CommentAssistantManualPanel: React.FC<CommentAssistantManualPanelProps> = ({
  active,
  onClose,
}) => {
  const [originalPost, setOriginalPost] = useState('');
  const [comment, setComment] = useState('');
  const [responseType, setResponseType] = useState<string>('professional');
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ reply: string; alternatives: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!active) return;
    setOriginalPost(readDraft());
    setComment('');
    setResult(null);
    setError('');
  }, [active]);

  const handleGenerate = async () => {
    if (!comment.trim()) {
      setError('Please paste the comment you received.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const req: LinkedInCommentResponseRequest = {
        original_post: originalPost,
        comment,
        response_type: responseType as LinkedInCommentResponseRequest['response_type'],
        include_question: includeQuestion,
      };
      const res = await linkedInWriterApi.generateCommentResponse(req);
      setResult({ reply: res.response ?? '', alternatives: res.alternative_responses ?? [] });
    } catch {
      setError('Could not generate reply. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
        {COMMENT_ASSISTANT_MANUAL_INTRO}
      </p>

      <FieldLabel label="Comment you received *" />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Paste the comment here…"
        style={textareaStyle(88)}
      />

      <FieldLabel label="Your original post (optional — improves context)" />
      <textarea
        value={originalPost}
        onChange={(e) => setOriginalPost(e.target.value)}
        placeholder="Paste your original post, or leave blank…"
        style={textareaStyle(72)}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <FieldLabel label="Reply type" />
          <select
            value={responseType}
            onChange={(e) => setResponseType(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 7,
              border: `1px solid ${colors.border}`,
              fontSize: 13,
              color: colors.textBody,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {RESPONSE_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: colors.textBody,
            cursor: 'pointer',
            marginTop: 18,
          }}
        >
          <input
            type="checkbox"
            checked={includeQuestion}
            onChange={(e) => setIncludeQuestion(e.target.checked)}
          />
          End with a question
        </label>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!result && (
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || !comment.trim()}
          style={{
            width: '100%',
            padding: '11px',
            background: colors.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: comment.trim() ? 'pointer' : 'default',
            opacity: comment.trim() ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? <><Spinner /> Drafting reply…</> : '💬 Generate Reply'}
        </button>
      )}

      {result && (
        <>
          <div style={{ ...rowBase, marginBottom: 10, borderLeft: `3px solid ${colors.primary}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              AI Reply
            </div>
            <div style={{ fontSize: 13, color: colors.textBody, lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 10 }}>
              {result.reply}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void handleCopy(result.reply)}
                style={{
                  padding: '6px 14px',
                  background: copied ? '#dcfce7' : colors.primary,
                  color: copied ? '#166534' : '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy Reply'}
              </button>
              <button
                type="button"
                onClick={() => { pushDraftToStudio(result.reply); onClose(); }}
                style={{
                  padding: '6px 14px',
                  background: 'none',
                  border: `1.5px solid ${colors.primary}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.primary,
                  cursor: 'pointer',
                }}
              >
                ✏️ Edit in Studio
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                style={{
                  padding: '6px 12px',
                  background: 'none',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: colors.textTertiary,
                  cursor: 'pointer',
                }}
              >
                ↩ Retry
              </button>
            </div>
          </div>

          {result.alternatives.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                {result.alternatives.length} Alternatives
              </div>
              {result.alternatives.map((alt, i) => (
                <AltReplyRow
                  key={i}
                  text={alt}
                  onCopy={handleCopy}
                  onUse={() => { pushDraftToStudio(alt); onClose(); }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
