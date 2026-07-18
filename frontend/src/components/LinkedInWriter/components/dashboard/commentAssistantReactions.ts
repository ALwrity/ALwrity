/**
 * LinkedIn v1 Unipile reaction types for Comment Assistant.
 * Matches Unipile POST /api/v1/posts/reaction reaction_type enum.
 */

export type CommentAssistantReactionType =
  | 'like'
  | 'celebrate'
  | 'support'
  | 'love'
  | 'insightful'
  | 'funny';

export interface CommentAssistantReactionOption {
  type: CommentAssistantReactionType;
  label: string;
  emoji: string;
  color: string;
}

export const COMMENT_ASSISTANT_REACTIONS: CommentAssistantReactionOption[] = [
  { type: 'like', label: 'Like', emoji: '👍', color: '#0a66c2' },
  { type: 'celebrate', label: 'Celebrate', emoji: '👏', color: '#44712e' },
  { type: 'support', label: 'Support', emoji: '🫂', color: '#7a3eb1' },
  { type: 'love', label: 'Love', emoji: '❤️', color: '#df704d' },
  { type: 'insightful', label: 'Insightful', emoji: '💡', color: '#c37d16' },
  { type: 'funny', label: 'Funny', emoji: '😂', color: '#0f7b8a' },
];

export function getReactionOption(
  type: string | null | undefined
): CommentAssistantReactionOption {
  const normalized = (type || 'like').toLowerCase().replace(/^linkedin_/, '');
  return (
    COMMENT_ASSISTANT_REACTIONS.find((r) => r.type === normalized) ||
    COMMENT_ASSISTANT_REACTIONS[0]
  );
}
