/**
 * Plain-language copy for Comment Assistant inbox (non-tech creators).
 */

export const COMMENT_ASSISTANT_TITLE = 'Comment Assistant';

export const COMMENT_ASSISTANT_INTRO =
  'Reply to comments on your posts in one place — no jumping between posts.';

export const COMMENT_ASSISTANT_TABS = {
  needs_reply: 'Needs reply',
  active: 'Active',
  older: 'Older',
  manual: 'Manual',
} as const;

export const COMMENT_ASSISTANT_EMPTY = {
  needs_reply: {
    title: 'You’re all caught up',
    desc: 'No comments need a reply right now. When someone comments on your posts, they’ll show up here.',
  },
  active: {
    title: 'No active threads',
    desc: 'Threads you’ve already replied to will appear here so you can follow up.',
  },
  older: {
    title: 'No older comments',
    desc: 'Older or finished threads will show up here when available.',
  },
} as const;

export const COMMENT_ASSISTANT_LOADING = 'Loading comments on your posts…';
export const COMMENT_ASSISTANT_LOADING_COMMENTS = 'Loading comments…';

export const COMMENT_ASSISTANT_NOT_CONNECTED = {
  title: 'Connect LinkedIn to see comments',
  desc: 'Link your LinkedIn account to load comments on your posts. You can still draft a reply with Manual.',
};

export const COMMENT_ASSISTANT_SYNC = 'Sync comments';
export const COMMENT_ASSISTANT_SYNCING = 'Syncing…';
export const COMMENT_ASSISTANT_COOLDOWN = (seconds: number) =>
  `Please wait ${seconds}s before syncing again.`;

export const COMMENT_ASSISTANT_LAST_UPDATED = (relative: string) =>
  `Last updated ${relative}`;

export const COMMENT_ASSISTANT_ACTIONS = {
  like: 'Like',
  liked: 'Liked',
  reply: 'Reply',
  draftAi: 'Draft with AI',
  drafting: 'Drafting…',
  send: 'Send reply',
  sending: 'Sending…',
  cancel: 'Cancel',
  retryPost: 'Retry this post',
  loadMore: 'Load more comments',
} as const;

export const COMMENT_ASSISTANT_REPLY_SENDING = 'Sending your reply…';
export const COMMENT_ASSISTANT_REPLY_SUCCESS = 'Reply posted successfully.';

export const COMMENT_ASSISTANT_MANUAL_INTRO =
  'Paste a comment and draft an AI reply in your voice — then copy it to LinkedIn.';

export const COMMENT_ASSISTANT_INBOX_HINT =
  'Comments on your recent posts. Sync to refresh from LinkedIn.';
