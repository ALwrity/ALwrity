/**
 * Inbox load helpers — progressive shell + full fetch (keeps hook under 500 lines).
 */
import { commentAssistantApi } from '../../../../services/commentAssistantApi';
import { mapGroupToView } from './commentAssistantMappers';
import type {
  CommentAssistantEmptyReason,
  CommentAssistantInboxResponse,
  CommentAssistantPostGroupView,
  CommentAssistantPriority,
} from './commentAssistantTypes';

export type InboxLoadResult = {
  groups: CommentAssistantPostGroupView[];
  counts: Partial<Record<'needs_reply' | 'active' | 'older', number>>;
  lastSyncedAt: string | null;
  emptyReason: CommentAssistantEmptyReason | null;
};

function toLoadResult(data: CommentAssistantInboxResponse): InboxLoadResult {
  return {
    groups: (data.groups || []).map(mapGroupToView),
    counts: {
      needs_reply: data.counts?.needs_reply ?? 0,
      active: data.counts?.active ?? 0,
      older: data.counts?.older ?? 0,
    },
    lastSyncedAt: data.last_synced_at || null,
    emptyReason: data.empty_reason || null,
  };
}

/**
 * Load inbox with optional progressive shell (post headers) while full data loads.
 * Shell is skipped when we already have groups (tab switch) to avoid flicker.
 */
export async function loadCommentAssistantInbox(options: {
  priority: Exclude<CommentAssistantPriority, 'all'>;
  refresh: boolean;
  showShell: boolean;
  isCurrent: () => boolean;
  onShell?: (partial: InboxLoadResult) => void;
}): Promise<InboxLoadResult> {
  const { priority, refresh, showShell, isCurrent, onShell } = options;

  let fullSettled = false;
  const fullPromise = commentAssistantApi
    .fetchInbox({ priority, refresh, shell: false })
    .finally(() => {
      fullSettled = true;
    });

  if (showShell) {
    void commentAssistantApi
      .fetchInbox({ priority, refresh: false, shell: true })
      .then((shell) => {
        if (fullSettled || !isCurrent() || !onShell) return;
        onShell(toLoadResult(shell));
      })
      .catch(() => {
        /* Shell is best-effort; full fetch still drives errors. */
      });
  }

  const data = await fullPromise;
  if (!isCurrent()) {
    return toLoadResult(data);
  }
  return toLoadResult(data);
}
