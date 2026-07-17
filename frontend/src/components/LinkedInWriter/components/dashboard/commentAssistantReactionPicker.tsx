/**
 * LinkedIn-style hover reaction tray for Comment Assistant.
 */
import React, { useRef, useState } from 'react';
import { colors } from '../GrowthEngine/styles';
import {
  COMMENT_ASSISTANT_REACTIONS,
  getReactionOption,
  type CommentAssistantReactionType,
} from './commentAssistantReactions';

interface CommentAssistantReactionPickerProps {
  disabled?: boolean;
  /** Current user reaction type if already reacted. */
  activeReaction?: string | null;
  reactionCount?: number;
  onReact: (type: CommentAssistantReactionType) => void;
}

export const CommentAssistantReactionPicker: React.FC<CommentAssistantReactionPickerProps> = ({
  disabled,
  activeReaction,
  reactionCount = 0,
  onReact,
}) => {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const active = getReactionOption(activeReaction);
  const hasReacted = Boolean(activeReaction);

  const clearClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      onMouseEnter={() => {
        if (disabled) return;
        clearClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      {open && !disabled && (
        <div
          role="menu"
          aria-label="Choose reaction"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            display: 'flex',
            gap: 2,
            padding: '6px 8px',
            borderRadius: 999,
            background: '#fff',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 20,
          }}
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          {COMMENT_ASSISTANT_REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              role="menuitem"
              title={r.label}
              onClick={() => {
                onReact(r.type);
                setOpen(false);
              }}
              style={{
                width: 34,
                height: 34,
                border: 'none',
                borderRadius: '50%',
                background: 'transparent',
                fontSize: 20,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onReact(hasReacted ? (active.type as CommentAssistantReactionType) : 'like');
        }}
        style={{
          padding: '3px 8px',
          borderRadius: 5,
          fontSize: 11,
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          border: `1px solid ${colors.border}`,
          background: '#fff',
          color: hasReacted ? active.color : colors.textSecondary,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {hasReacted ? `${active.emoji} ${active.label}` : 'Like'}
      </button>

      {reactionCount > 0 && (
        <span
          title={`${reactionCount} reaction${reactionCount === 1 ? '' : 's'}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            color: colors.textTertiary,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#e8f3ff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
            }}
          >
            {hasReacted ? active.emoji : '👍'}
          </span>
          {reactionCount}
        </span>
      )}
    </div>
  );
};
