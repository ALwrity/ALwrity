/**
 * LinkedIn-style reply composer: @mention prefix, emoji picker, image attach.
 */
import React, { useEffect, useRef, useState } from 'react';
import { colors } from '../GrowthEngine/styles';
import { COMMENT_ASSISTANT_ACTIONS } from './commentAssistantCopy';
import { COMMENT_ASSISTANT_EMOJI_PALETTE } from './commentAssistantEmojis';
import { UNIPILE_MAX_COMMENT_LENGTH } from './postCommentsTypes';

export interface CommentAssistantReplyPayload {
  text: string;
  mentions?: Array<{ name: string; profile_id: string }>;
  imageFile?: File | null;
}

interface CommentAssistantReplyComposerProps {
  authorName: string;
  authorId?: string | null;
  initialText?: string;
  busy?: boolean;
  onSend: (payload: CommentAssistantReplyPayload) => void;
  onCancel: () => void;
}

function buildMentionPrefix(authorName: string): string {
  return `@${authorName} `;
}

/** Convert UI @Name prefix into Unipile {{0}} + mentions when profile_id exists. */
export function toUnipileReplyPayload(
  displayText: string,
  authorName: string,
  authorId?: string | null,
  imageFile?: File | null
): CommentAssistantReplyPayload {
  const prefix = buildMentionPrefix(authorName);
  const trimmed = displayText.trim();
  const hasPrefix =
    trimmed === `@${authorName}` ||
    trimmed.startsWith(prefix) ||
    trimmed.startsWith(`@${authorName}`);

  if (authorId && hasPrefix) {
    const rest = trimmed.startsWith(prefix)
      ? trimmed.slice(prefix.length).trim()
      : trimmed.slice(`@${authorName}`.length).trim();
    return {
      text: rest ? `{{0}} ${rest}` : '{{0}}',
      mentions: [{ name: authorName, profile_id: authorId }],
      imageFile: imageFile || null,
    };
  }

  return { text: trimmed, imageFile: imageFile || null };
}

export const CommentAssistantReplyComposer: React.FC<CommentAssistantReplyComposerProps> = ({
  authorName,
  authorId,
  initialText = '',
  busy = false,
  onSend,
  onCancel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => {
    if (initialText.trim()) return initialText;
    return buildMentionPrefix(authorName);
  });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (initialText.trim()) {
      setText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    textareaRef.current?.focus();
    const el = textareaRef.current;
    if (el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    window.setTimeout(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    }, 0);
    setEmojiOpen(false);
  };

  const canSend = Boolean(text.trim()) && !busy;

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          background: '#fff',
          padding: '8px 10px',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Reply to ${authorName}…`}
          rows={2}
          maxLength={UNIPILE_MAX_COMMENT_LENGTH}
          disabled={busy}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontSize: 12,
            fontFamily: 'inherit',
            lineHeight: 1.45,
            color: colors.textBody,
            minHeight: 48,
          }}
        />

        {imagePreview && (
          <div style={{ position: 'relative', display: 'inline-block', marginTop: 6 }}>
            <img
              src={imagePreview}
              alt=""
              style={{
                maxWidth: 120,
                maxHeight: 80,
                borderRadius: 6,
                objectFit: 'cover',
                border: `1px solid ${colors.border}`,
              }}
            />
            <button
              type="button"
              onClick={() => setImageFile(null)}
              disabled={busy}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: 'none',
                background: '#111827',
                color: '#fff',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 6,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              title="Add emoji"
              disabled={busy}
              onClick={() => setEmojiOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 18,
                cursor: busy ? 'default' : 'pointer',
                padding: 2,
                lineHeight: 1,
              }}
            >
              😊
            </button>
            <button
              type="button"
              title="Add image"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 16,
                cursor: busy ? 'default' : 'pointer',
                padding: 2,
                lineHeight: 1,
                color: colors.textSecondary,
              }}
            >
              🖼️
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setImageFile(file);
                e.target.value = '';
              }}
            />
            {!authorId && (
              <span style={{ fontSize: 10, color: colors.textTertiary }}>
                Mention may send as plain text
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: colors.textTertiary }}>
            {text.length}/{UNIPILE_MAX_COMMENT_LENGTH}
          </div>
        </div>

        {emojiOpen && (
          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 4,
              padding: 8,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: '#fafbfc',
            }}
          >
            {COMMENT_ASSISTANT_EMOJI_PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          type="button"
          disabled={!canSend}
          onClick={() =>
            onSend(toUnipileReplyPayload(text, authorName, authorId, imageFile))
          }
          style={{
            padding: '5px 12px',
            borderRadius: 999,
            border: 'none',
            background: canSend ? colors.primary : '#d1d5db',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: canSend ? 'pointer' : 'default',
          }}
        >
          {busy ? COMMENT_ASSISTANT_ACTIONS.sending : 'Reply'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{
            padding: '5px 10px',
            borderRadius: 5,
            border: `1px solid ${colors.border}`,
            background: '#fff',
            fontSize: 11,
            fontWeight: 600,
            color: colors.textSecondary,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {COMMENT_ASSISTANT_ACTIONS.cancel}
        </button>
      </div>
    </div>
  );
};
