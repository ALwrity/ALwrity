/**
 * Shared Comment Reply Assistant modal test harness.
 * Each suite still owns its cases; this only mocks APIs and fixtures.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommentAssistantModal } from "../modals/CommentAssistantModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import type { YouTubeInboxComment, YouTubeInboxReply } from "../youtubeCommentVideoGroups";

vi.mock("../../../../services/youtubeStudioApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../services/youtubeStudioApi")>();
  return {
    ...actual,
    youtubeStudioApi: {
      getCommentInbox: vi.fn(),
      draftCommentReply: vi.fn(),
      sendCommentReply: vi.fn(),
      listCommentReplies: vi.fn(),
      updateCommentReply: vi.fn(),
      deleteCommentReply: vi.fn(),
    },
  };
});

vi.mock("../YouTubeCommentIframePlayer", () => ({
  YouTubeCommentIframePlayer: ({ videoId }: { videoId: string }) => (
    <div data-testid="youtube-comment-iframe-player" data-video-id={videoId} />
  ),
}));

export const mockedStudioApi = vi.mocked(youtubeStudioApi);

export const inboxComment: YouTubeInboxComment = {
  comment_id: "c-1",
  video_id: "abcdefghijk",
  video_title: "Rank Videos in 7 Days",
  author: "Sam",
  text: "Loved the intro",
};

export const ownReply: YouTubeInboxReply = {
  comment_id: "r-own",
  author: "MyChannel",
  text: "Thanks",
  can_edit: true,
};

export function commentWithReplies(
  replies: YouTubeInboxReply[],
  totalReplyCount = replies.length,
): YouTubeInboxComment {
  return {
    ...inboxComment,
    total_reply_count: totalReplyCount,
    replies,
  };
}

export const ownReplyInbox = commentWithReplies([ownReply], 1);

export function renderAssistant(open = true) {
  return render(
    <CommentAssistantModal open={open} onClose={vi.fn()} niche="seo" />,
  );
}

export function rerenderAssistant(
  rerender: (ui: React.ReactElement) => void,
  open: boolean,
) {
  rerender(<CommentAssistantModal open={open} onClose={vi.fn()} niche="seo" />);
}

export async function expandThreadReplies() {
  fireEvent.click(await screen.findByRole("button", { name: /^\d+ repl(?:y|ies)$/ }));
}

export function stubLoadedInbox(comments: YouTubeInboxComment[] = [inboxComment]) {
  mockedStudioApi.getCommentInbox.mockResolvedValue({
    success: true,
    comments,
    message: `Loaded ${comments.length} recent comments.`,
  });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
