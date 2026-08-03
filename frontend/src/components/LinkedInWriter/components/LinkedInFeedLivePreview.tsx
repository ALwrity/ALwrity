/**
 * LinkedIn feed live preview — device mockup, see-more truncation, media layout.
 * Reuses publish plain-text pipeline and draft image segments.
 */
import React, { useMemo, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import RepeatIcon from "@mui/icons-material/Repeat";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { LINKEDIN_PUBLISH_PLAIN_NOTE } from "../utils/linkedInPostFormatConstants";
import type { LinkedInFeedDevice } from "../utils/linkedInFeedPreviewUtils";
import {
  formatCharCountLabel,
  getCharReadiness,
  getPublishPlainText,
  getSeeMoreCaption,
} from "../utils/linkedInPublishReadiness";
import type { LinkedInPublishMediaAttachment } from "../utils/linkedInPublishMediaUtils";
import { LinkedInFeedPreviewFrame } from "./LinkedInFeedPreviewFrame";
import { LinkedInFeedPostBody } from "./LinkedInFeedPostBody";
import { LinkedInFeedMediaStrip } from "./LinkedInFeedMediaStrip";
import { LinkedInAuthenticatedImage } from "./LinkedInAuthenticatedImage";

const LOG_PREFIX = "[LinkedInFeedLivePreview]";

export interface LinkedInFeedLivePreviewProps {
  draft: string;
  plainText?: string;
  attachment?: LinkedInPublishMediaAttachment | null;
  compact?: boolean;
  authorName?: string;
  authorHeadline?: string;
  authorAvatarUrl?: string | null;
}

function resolveAttachmentImage(
  attachment: LinkedInPublishMediaAttachment | null | undefined,
):
  | { kind: "ai"; imageId: string; alt: string }
  | { kind: "upload"; url: string; alt: string }
  | null {
  if (!attachment) return null;
  if (attachment.source === "ai") {
    return {
      kind: "ai",
      imageId: attachment.imageId,
      alt: attachment.alt || "Post image",
    };
  }
  return {
    kind: "upload",
    url: attachment.previewUrl,
    alt: attachment.fileName || "Post image",
  };
}

function AuthorAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const initial = (name.trim()[0] || "Y").toUpperCase();
  if (avatarUrl) {
    return (
      <Box
        component="img"
        src={avatarUrl}
        alt=""
        sx={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        bgcolor: "#0a66c2",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 18,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {initial}
    </Box>
  );
}

export const LinkedInFeedLivePreview: React.FC<LinkedInFeedLivePreviewProps> = ({
  draft,
  plainText,
  attachment = null,
  compact = false,
  authorName = "You",
  authorHeadline = "Your headline",
  authorAvatarUrl = null,
}) => {
  const [device, setDevice] = useState<LinkedInFeedDevice>("desktop");

  const text = useMemo(() => {
    try {
      return (plainText ?? getPublishPlainText(draft)).trim();
    } catch (err) {
      console.error(`${LOG_PREFIX} failed to normalize draft for preview`, err);
      return "";
    }
  }, [draft, plainText]);

  const chars = getCharReadiness(text);
  const seeMoreCaption = getSeeMoreCaption(chars);
  const attachmentImage = resolveAttachmentImage(attachment);

  return (
    <Box
      sx={{
        border: "1px solid #e2e8f0",
        borderRadius: 2,
        bgcolor: "#fff",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: compact ? 1.25 : 1.5,
          py: 1,
          borderBottom: "1px solid #e2e8f0",
          bgcolor: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          LinkedIn feed preview
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: chars.hardOk ? "#64748b" : "#dc2626",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {formatCharCountLabel(chars.count)}
        </Typography>
      </Box>

      <Box sx={{ p: compact ? 1.25 : 1.75 }}>
        <LinkedInFeedPreviewFrame device={device} onDeviceChange={setDevice}>
          <Box
            sx={{
              bgcolor: "#fff",
              borderRadius: 1,
              border: "1px solid #e0e0e0",
              p: 1.5,
            }}
          >
            <Box sx={{ display: "flex", gap: 1.25, mb: 1.25 }}>
              <AuthorAvatar name={authorName} avatarUrl={authorAvatarUrl} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "rgba(0,0,0,0.9)",
                    lineHeight: 1.3,
                  }}
                >
                  {authorName}
                </Typography>
                <Typography
                  noWrap
                  sx={{
                    fontSize: 12,
                    color: "rgba(0,0,0,0.6)",
                    lineHeight: 1.3,
                  }}
                >
                  {authorHeadline}
                </Typography>
                <Typography sx={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
                  Just now · 🌐
                </Typography>
              </Box>
            </Box>

            <LinkedInFeedPostBody
              plainText={text}
              device={device}
              compact={compact}
            />

            <LinkedInFeedMediaStrip draft={draft} device={device} />

            {attachmentImage && (
              <Box
                sx={{
                  mt: 1.25,
                  borderRadius: device === "mobile" ? 0 : 1,
                  overflow: "hidden",
                  mx: device === "mobile" ? -1.5 : 0,
                  border: device === "mobile" ? "none" : "1px solid #e0e0e0",
                  "& img": {
                    width: "100%",
                    maxHeight: 280,
                    objectFit: "cover",
                    display: "block",
                    margin: "0 !important",
                  },
                }}
              >
                {attachmentImage.kind === "ai" ? (
                  <LinkedInAuthenticatedImage
                    imageId={attachmentImage.imageId}
                    alt={attachmentImage.alt}
                  />
                ) : (
                  <Box
                    component="img"
                    src={attachmentImage.url}
                    alt={attachmentImage.alt}
                  />
                )}
              </Box>
            )}

            <Box
              sx={{
                mt: 1.25,
                pt: 1,
                borderTop: "1px solid #e8e8e8",
                display: "flex",
                justifyContent: "space-around",
                color: "rgba(0,0,0,0.6)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 12 }}>
                <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />
                Like
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 12 }}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
                Comment
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 12 }}>
                <RepeatIcon sx={{ fontSize: 18 }} />
                Repost
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 12 }}>
                <SendOutlinedIcon sx={{ fontSize: 18 }} />
                Send
              </Box>
            </Box>
          </Box>
        </LinkedInFeedPreviewFrame>

        {seeMoreCaption && (
          <Alert severity="info" sx={{ mt: 1.25, py: 0, fontSize: 12 }}>
            {seeMoreCaption}
          </Alert>
        )}

        <Typography
          variant="caption"
          sx={{ color: "#64748b", display: "block", mt: 1.25, lineHeight: 1.4 }}
        >
          {LINKEDIN_PUBLISH_PLAIN_NOTE}
        </Typography>
      </Box>
    </Box>
  );
};
