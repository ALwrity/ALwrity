/**
 * Group inbox comments by video_id in first-appearance order.
 * Never invents titles; uses youtubeCommentVideoHeading.
 * Grouping must not throw for malformed inbox rows.
 */

import { youtubeCommentVideoHeading } from "./youtubeCommentVideoHeading";

export const YOUTUBE_COMMENT_VIDEO_UNAVAILABLE_GROUP_KEY = "__unavailable__";

export type YouTubeInboxReply = {
  comment_id?: string;
  author?: string;
  text?: string;
  published_at?: string;
  can_edit?: boolean;
};

export type YouTubeInboxComment = {
  comment_id?: string;
  video_id?: string | null;
  video_title?: string | null;
  author?: string;
  text?: string;
  replies?: YouTubeInboxReply[];
  total_reply_count?: number;
};

export type YouTubeCommentVideoGroupModel = {
  key: string;
  heading: string;
  comments: YouTubeInboxComment[];
};

export function youtubeCommentCountLabel(count: number): string {
  return count === 1 ? "1 comment" : `${count} comments`;
}

export function youtubeCommentReplyCountLabel(count: number): string {
  return count === 1 ? "1 reply" : `${count} replies`;
}

function youtubeCommentVideoGroupKey(comment: YouTubeInboxComment): string {
  const videoId = (comment.video_id || "").trim();
  return videoId || YOUTUBE_COMMENT_VIDEO_UNAVAILABLE_GROUP_KEY;
}

export function groupYouTubeInboxCommentsByVideo(
  comments: YouTubeInboxComment[] | null | undefined,
): YouTubeCommentVideoGroupModel[] {
  if (!Array.isArray(comments) || comments.length === 0) {
    return [];
  }

  const groups: YouTubeCommentVideoGroupModel[] = [];
  const indexByKey = new Map<string, number>();

  for (const comment of comments) {
    if (!comment || typeof comment !== "object") {
      continue;
    }
    const key = youtubeCommentVideoGroupKey(comment);
    const existingIndex = indexByKey.get(key);
    if (existingIndex !== undefined) {
      groups[existingIndex].comments.push(comment);
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push({
      key,
      heading: youtubeCommentVideoHeading(comment),
      comments: [comment],
    });
  }

  return groups;
}
