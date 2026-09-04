/**
 * Heading label for which video a comment belongs to.
 * Never invents a fake video title.
 */

const YOUTUBE_COMMENT_VIDEO_ID_SHORT_LEN = 8;
const YOUTUBE_COMMENT_VIDEO_UNAVAILABLE = "Video unavailable";

export function youtubeCommentVideoHeading(comment: {
  video_title?: string | null;
  video_id?: string | null;
}): string {
  const title = (comment.video_title || "").trim();
  const videoId = (comment.video_id || "").trim();
  if (title && videoId && title === videoId) {
    return videoId.slice(0, YOUTUBE_COMMENT_VIDEO_ID_SHORT_LEN);
  }
  if (title) {
    return title;
  }
  if (videoId) {
    return videoId.slice(0, YOUTUBE_COMMENT_VIDEO_ID_SHORT_LEN);
  }
  return YOUTUBE_COMMENT_VIDEO_UNAVAILABLE;
}
