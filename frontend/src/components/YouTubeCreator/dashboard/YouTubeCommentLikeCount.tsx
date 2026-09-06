import React from "react";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import {
  youtubeCommentLikeCountLabel,
  youtubeCommentVisibleLikeCount,
} from "./youtubeCommentVideoGroups";

export const YouTubeCommentLikeCount: React.FC<{
  likeCount?: number | null;
}> = ({ likeCount }) => {
  const visible = youtubeCommentVisibleLikeCount(likeCount);
  if (visible == null) {
    return null;
  }
  return (
    <p className="yt-comment-like-count">
      <ThumbUpOutlinedIcon
        className="yt-comment-like-count-icon"
        aria-hidden="true"
        focusable="false"
        fontSize="inherit"
      />
      <span>{youtubeCommentLikeCountLabel(visible)}</span>
    </p>
  );
};
