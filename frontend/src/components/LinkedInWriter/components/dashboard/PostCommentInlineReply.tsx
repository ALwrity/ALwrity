import React, { useEffect, useRef } from 'react';

import { colors } from '../GrowthEngine/styles';
import { UNIPILE_MAX_COMMENT_LENGTH } from './postCommentsTypes';

export interface PostCommentInlineReplyProps {
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  canSend: boolean;
  sending: boolean;
  disabled?: boolean;
  error?: string;
}

/**
 * Inline reply composer shown under a selected comment card.
 */
export const PostCommentInlineReply: React.FC<PostCommentInlineReplyProps> = ({
  replyText,
  onReplyTextChange,
  onSend,
  onCancel,
  canSend,
  sending,
  disabled = false,
  error,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary }}>
          Replying to this
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textTertiary,
            fontSize: 11,
            fontWeight: 600,
            cursor: sending ? 'not-allowed' : 'pointer',
            padding: '2px 4px',
          }}
        >
          Cancel
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={replyText}
        onChange={(e) => onReplyTextChange(e.target.value)}
        placeholder="Write your reply here..."
        maxLength={UNIPILE_MAX_COMMENT_LENGTH}
        disabled={disabled || sending}
        rows={3}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 10px',
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          fontSize: 13,
          resize: 'vertical',
          fontFamily: 'inherit',
          marginBottom: 6,
          maxHeight: 140,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 11, color: colors.textTertiary }}>
          {replyText.length}/{UNIPILE_MAX_COMMENT_LENGTH}
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          style={{
            padding: '7px 14px',
            background: canSend ? colors.primary : '#d1d5db',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: canSend ? 'pointer' : 'not-allowed',
            opacity: sending ? 0.7 : 1,
            marginLeft: 'auto',
          }}
        >
          {sending ? 'Sending…' : 'Send Reply'}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{error}</div>
      )}
    </div>
  );
};
