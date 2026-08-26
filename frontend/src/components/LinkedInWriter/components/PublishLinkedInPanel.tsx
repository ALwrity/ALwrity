import React, { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  LinearProgress,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import ImageIcon from '@mui/icons-material/Image';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import { useLinkedInSocialConnection } from "../../../hooks/useLinkedInSocialConnection";
import { getLinkedInPublishErrorMessage } from "../../../api/linkedinSocial";
import { useLinkedInPublishMedia } from "../hooks/useLinkedInPublishMedia";
import { useLinkedInSelectionImage } from "../hooks/useLinkedInSelectionImage";
import { LinkedInPublishMediaSection } from "./LinkedInPublishMediaSection";
import { LinkedInSelectionImageModal } from "./LinkedInSelectionImageModal";
import { LinkedInPublishPreviewPlain } from "./LinkedInPublishPreviewPlain";
import { LinkedInPublishChecklist } from "./LinkedInPublishChecklist";
import { PublishLinkedInLimitCaption } from "./PublishLinkedInLimitCaption";
import { readPrefs } from "../utils/linkedInWriterUtils";
import {
  buildLinkedInPublishSuccessMessage,
  publishLinkedInWithMedia,
} from "../utils/linkedInPublishHandler";
import {
  getLastDraftImageForPublish,
  resolvePublishMediaAttachment,
} from "../utils/linkedInPublishMediaUtils";
import {
  areHardPublishChecksOk,
  assertHardPublishLimits,
  getPublishPlainText,
  isArticleUnipilePublishBlocked,
  resolveArticleWordTarget,
} from "../utils/linkedInPublishReadiness";
import { LINKEDIN_ARTICLE_PUBLISH_DISABLED_TOOLTIP } from "../utils/linkedInPostFormatConstants";

interface PublishLinkedInPanelProps {
  draft: string;
  /** Session content type — wired for PR2–7; no publish change in PR1. */
  draftContentType?: import("../utils/linkedInDraftLibraryUtils").LinkedInDraftContentType;
  topic?: string;
  compact?: boolean;
  /** Flush assistive editor pending edits and return latest draft before publish. */
  getDraftForPublish?: () => string;
  /** Insert AI-generated image markdown into the assistive editor draft. */
  onInsertImageIntoDraft?: (imageUrl: string) => void;
}

interface PublishSuccessState {
  message: string;
  shareUrl?: string | null;
  hasMedia?: boolean;
}

type PublishStep = "idle" | "formatting" | "uploading" | "publishing" | "done" | "error";

const PUBLISH_STEPS: { step: PublishStep; label: string }[] = [
  { step: "formatting", label: "Formatting content for LinkedIn..." },
  { step: "uploading", label: "Uploading media..." },
  { step: "publishing", label: "Publishing to LinkedIn..." },
  { step: "done", label: "Published!" },
];

const PublishLinkedInPanel: React.FC<PublishLinkedInPanelProps> = ({
  draft,
  draftContentType,
  topic,
  compact = false,
  getDraftForPublish,
  onInsertImageIntoDraft,
}) => {
  const { connected, provider, selectedAccountId, selectedTarget, isLoading,
    isConnecting, connectWithOAuth } =
    useLinkedInSocialConnection();

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<PublishStep>("idle");
  const [showProgress, setShowProgress] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<PublishSuccessState | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [mediaAnchor, setMediaAnchor] = useState<HTMLElement | null>(null);
  const prefs = readPrefs();
  const articlePublishBlocked = isArticleUnipilePublishBlocked(draftContentType);
  const articleWordTarget = resolveArticleWordTarget(prefs);

  const publishMedia = useLinkedInPublishMedia({
    draft,
    autoDetectFromDraft: true,
  });

  const selectionImage = useLinkedInSelectionImage({
    topic,
    industry: prefs.industry,
    onInsertImage: onInsertImageIntoDraft,
    onImageGenerated: (preview) => {
      if (preview.imageId && preview.imageUrl) {
        publishMedia.attachAiImage({
          imageId: preview.imageId,
          imageUrl: preview.imageUrl,
        });
      }
    },
  });

  const closeMediaPopover = useCallback(() => {
    setMediaAnchor(null);
  }, []);

  const publishContent = getPublishPlainText(draft);
  const draftHasImage = Boolean(getLastDraftImageForPublish(draft));
  const hasPublishMedia = publishMedia.hasAttachment || draftHasImage;
  const previewAttachment = resolvePublishMediaAttachment(
    draft,
    publishMedia.attachment,
  );
  const isOrgTarget = selectedTarget === "organization";
  const hardChecksOk = areHardPublishChecksOk(publishContent);
  const canPublish =
    connected &&
    hardChecksOk &&
    !isOrgTarget &&
    !isPublishing &&
    !isLoading &&
    !articlePublishBlocked;

  const publishButtonLabel =
    isPublishing
      ? "Publishing..."
      : isConnecting
        ? "Connecting..."
        : articlePublishBlocked || connected
          ? "Publish"
          : "Connect";

  const publishButtonTooltip = articlePublishBlocked
    ? LINKEDIN_ARTICLE_PUBLISH_DISABLED_TOOLTIP
    : connected
      ? "Publish to LinkedIn"
      : "Connect your LinkedIn account to publish posts";

  const handleCopyDraft = useCallback(async () => {
    const text = getPublishPlainText(getDraftForPublish?.() ?? draft);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Draft copied to clipboard.");
      console.log("[LinkedInPublish] article draft copied to clipboard", {
        length: text.length,
      });
    } catch (err) {
      console.error("[LinkedInPublish] failed to copy article draft", err);
      setCopyFeedback("Could not copy draft. Select and copy manually.");
    }
  }, [draft, getDraftForPublish]);

  const connectionLabel = connected
    ? `Connected via ${provider}`
    : "Not connected — connect LinkedIn to publish";

  const handlePublish = async () => {
    if (articlePublishBlocked) {
      console.warn("[LinkedInPublish] blocked article publish attempt", {
        draftContentType,
      });
      return;
    }
    if (!canPublish) return;

    const draftForPublish = getDraftForPublish?.() ?? draft;
    const contentForPublish = getPublishPlainText(draftForPublish);
    const hardCheck = assertHardPublishLimits(contentForPublish);
    if (!hardCheck.ok) {
      setErrorMessage(hardCheck.error || "Cannot publish this post.");
      setSuccessState(null);
      return;
    }

    setIsPublishing(true);
    setShowProgress(true);
    setPublishStep("formatting");
    setPublishError(null);
    publishMedia.beginPublishing();
    setSuccessState(null);
    setErrorMessage(null);

    try {
      // Step 1: Formatting (brief pause for UX)
      await new Promise(r => setTimeout(r, 300));

      // Step 2: Uploading media (if any)
      if (publishMedia.hasAttachment) {
        setPublishStep("uploading");
        await new Promise(r => setTimeout(r, 400));
      }

      // Step 3: Publishing
      setPublishStep("publishing");
      const result = await publishLinkedInWithMedia({
        content: contentForPublish,
        accountId: selectedAccountId || undefined,
        draft: draftForPublish,
        attachment: publishMedia.attachment,
      });

      // Step 4: Done
      setPublishStep("done");
      setSuccessState({
        message: buildLinkedInPublishSuccessMessage(result),
        shareUrl: result.share_url,
        hasMedia: result.has_media,
      });
    } catch (err) {
      console.error("[LinkedInPublish] publish failed:", err);
      setPublishStep("error");
      setPublishError(getLinkedInPublishErrorMessage(err));
      setErrorMessage(getLinkedInPublishErrorMessage(err));
    } finally {
      setIsPublishing(false);
      publishMedia.endPublishing();
    }
  };

  const successDetails = successState ? (
    <Box>
      <Typography variant="caption" sx={{ color: "#059669", display: "block" }}>
        {successState.message}
      </Typography>
      {successState.hasMedia && (
        <Typography
          variant="caption"
          sx={{ color: "#059669", display: "block" }}
        >
          Published with image
        </Typography>
      )}
      {successState.shareUrl && (
        <Link
          href={successState.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          sx={{ display: "block", mt: 0.5 }}
        >
          View on LinkedIn
        </Link>
      )}
    </Box>
  ) : null;

  const limitCaption = (
    <PublishLinkedInLimitCaption
      plainText={publishContent}
      contentType={draftContentType}
      targetWordCount={articleWordTarget}
    />
  );

  const mediaControls = (
    <>
      <Tooltip title={hasPublishMedia ? "Image attached" : "Add post image"}>
        <IconButton
          size="small"
          onClick={(event) => setMediaAnchor(event.currentTarget)}
          sx={{
            color: hasPublishMedia ? "#0A66C2" : "#64748b",
            border: "1px solid #e2e8f0",
          }}
        >
          <ImageIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {hasPublishMedia ? (
        <Chip
          size="small"
          label="1 image"
          sx={{
            height: 24,
            fontSize: 11,
            bgcolor: "#e8f4fd",
            color: "#0A66C2",
          }}
        />
      ) : null}
      <Popover
        open={Boolean(mediaAnchor)}
        anchorEl={mediaAnchor}
        onClose={() => setMediaAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { p: 2, width: 360, maxWidth: "92vw" },
          },
        }}
      >
        <LinkedInPublishMediaSection
          draft={draft}
          topic={topic}
          compact
          media={publishMedia}
          selectionImage={selectionImage}
          renderImageModal={false}
          onBeforeOpenAiGenerator={closeMediaPopover}
        />
      </Popover>
    </>
  );

  const imageGenerationModal = (
    <LinkedInSelectionImageModal
      open={selectionImage.modalOpen}
      onClose={selectionImage.closeModal}
      onGenerate={selectionImage.handleGenerate}
      initialPrompt={selectionImage.initialPrompt}
      isGenerating={selectionImage.isGenerating}
      generatedPreview={selectionImage.generatedPreview}
      onClosePreview={selectionImage.closePreview}
    />
  );

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        {imageGenerationModal}
        {/* Progress modal */}
        <PublishProgressModal
          open={showProgress}
          step={publishStep}
          error={publishError}
          successState={successState}
          onClose={() => setShowProgress(false)}
        />

        {!articlePublishBlocked ? mediaControls : null}
        {limitCaption}
        <Tooltip title={publishButtonTooltip} arrow>
          <span>
            <Button
              variant="contained"
              disabled={
                isPublishing ||
                isConnecting ||
                articlePublishBlocked ||
                (connected && !hardChecksOk)
              }
              onClick={connected ? handlePublish : () => { void connectWithOAuth(); }}
              startIcon={
                isPublishing || isConnecting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <LinkedInIcon />
                )
              }
              sx={{
                bgcolor: "#0A66C2",
                "&:hover": { bgcolor: "#004182" },
                textTransform: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {publishButtonLabel}
            </Button>
          </span>
        </Tooltip>
        {successDetails}
        {errorMessage && (
          <Typography
            variant="caption"
            sx={{ color: "#dc2626", maxWidth: 220 }}
          >
            {errorMessage}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <>
      {imageGenerationModal}
      <PublishProgressModal
        open={showProgress}
        step={publishStep}
        error={publishError}
        successState={successState}
        onClose={() => setShowProgress(false)}
      />
      <Box
      sx={{
        mx: 3,
        mb: 2,
        p: 2,
        border: "1px solid #e2e8f0",
        borderRadius: 2,
        bgcolor: "#f8fafc",
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <LinkedInIcon sx={{ color: "#0A66C2", fontSize: 20 }} />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, color: "#1e293b" }}
        >
          Publish to LinkedIn
        </Typography>
      </Box>

      <Typography
        variant="caption"
        sx={{ color: "#64748b", display: "block", mb: 1.5 }}
      >
        {connectionLabel}
        {connected && selectedAccountId && (
          <>
            {" "}
            · Post as{" "}
            {selectedTarget === "organization" ? "company page" : "profile"}
          </>
        )}
      </Typography>

      <Typography
        variant="caption"
        sx={{ color: "#64748b", display: "block", mb: 1.5 }}
      >
        {articlePublishBlocked
          ? "Copy your article draft and finish publishing in LinkedIn's native article editor."
          : "Publish your draft text to your LinkedIn personal profile with optional image attachment."}
      </Typography>

      {!articlePublishBlocked ? (
        <LinkedInPublishMediaSection
          draft={draft}
          topic={topic}
          media={publishMedia}
          selectionImage={selectionImage}
          renderImageModal={false}
        />
      ) : null}

      <Box sx={{ mb: 1.5 }}>
        <LinkedInPublishPreviewPlain
          draft={draft}
          attachment={previewAttachment}
          forPublish
          contentType={draftContentType}
          targetWordCount={articleWordTarget}
        />
      </Box>

      {!articlePublishBlocked ? (
        <Box sx={{ mb: 1.5 }}>
          <LinkedInPublishChecklist
            draft={publishContent}
            hasMedia={hasPublishMedia}
            compact
          />
          <Box sx={{ mt: 1 }}>{limitCaption}</Box>
        </Box>
      ) : (
        <Box sx={{ mb: 1.5 }}>
          {limitCaption}
        </Box>
      )}

      {articlePublishBlocked && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {LINKEDIN_ARTICLE_PUBLISH_DISABLED_TOOLTIP}
          <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => { void handleCopyDraft(); }}
              sx={{ textTransform: "none" }}
            >
              Copy draft
            </Button>
            {copyFeedback ? (
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                {copyFeedback}
              </Typography>
            ) : null}
          </Box>
        </Alert>
      )}

      {isOrgTarget && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Switch to personal profile to publish. Company page posting is not
          available yet.
        </Alert>
      )}

      {successState && (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {successState.message}
          {successState.hasMedia && (
            <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
              Published with image
            </Typography>
          )}
          {successState.shareUrl && (
            <Link
              href={successState.shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              sx={{ display: "block", mt: 0.5 }}
            >
              View on LinkedIn
            </Link>
          )}
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {errorMessage}
        </Alert>
      )}

      <Tooltip title={publishButtonTooltip} arrow>
        <span>
          <Button
            variant="contained"
            disabled={
              isPublishing ||
              isConnecting ||
              articlePublishBlocked ||
              (connected && !hardChecksOk)
            }
            onClick={connected ? handlePublish : () => { void connectWithOAuth(); }}
            startIcon={
              isPublishing || isConnecting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
            sx={{ bgcolor: "#0A66C2", "&:hover": { bgcolor: "#004182" } }}
          >
            {publishButtonLabel}
          </Button>
        </span>
      </Tooltip>
    </Box>
    </>
  );
};

// ── Publish Progress Modal ──

interface PublishProgressModalProps {
  open: boolean;
  step: PublishStep;
  error: string | null;
  successState: PublishSuccessState | null;
  onClose: () => void;
}

const PublishProgressModal: React.FC<PublishProgressModalProps> = ({
  open, step, error, successState, onClose,
}) => (
  <Dialog
    open={open}
    onClose={step === "done" || step === "error" ? onClose : undefined}
    maxWidth="xs"
    fullWidth
    slotProps={{ backdrop: { sx: { backdropFilter: 'blur(2px)' } } }}
    PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
  >
    <DialogTitle sx={{ textAlign: "center", pb: 0 }}>
      {step === "error" ? (
        <ErrorIcon sx={{ fontSize: 44, color: "#dc2626" }} />
      ) : step === "done" ? (
        <CheckCircleIcon sx={{ fontSize: 44, color: "#059669" }} />
      ) : (
        <LinkedInIcon sx={{ fontSize: 44, color: "#0A66C2" }} />
      )}
    </DialogTitle>
    <DialogContent sx={{ textAlign: "center", pt: 2 }}>
      {step === "done" && successState ? (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Published to LinkedIn!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {successState.message}
          </Typography>
          {successState.shareUrl && (
            <Button
              variant="contained"
              href={successState.shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon />}
              sx={{ bgcolor: "#0A66C2", "&:hover": { bgcolor: "#004182" }, mb: 1 }}
            >
              View on LinkedIn
            </Button>
          )}
          <br />
          <Button variant="text" onClick={onClose} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </>
      ) : step === "error" ? (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#dc2626", mb: 1 }}>
            Publish Failed
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {error || "An unexpected error occurred. Please try again."}
          </Typography>
          <Button variant="outlined" onClick={onClose} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </>
      ) : (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Publishing...
          </Typography>
          <LinearProgress
            sx={{ mb: 2, height: 6, borderRadius: 3 }}
            variant={step === "idle" ? "indeterminate" : "determinate"}
            value={
              step === "formatting" ? 25 :
              step === "uploading" ? 50 :
              step === "publishing" ? 75 : 0
            }
          />
          {PUBLISH_STEPS.map((s) => (
            <Typography
              key={s.step}
              variant="body2"
              sx={{
                color: step === s.step ? "text.primary" : step === "done" ? "#059669" : "text.disabled",
                fontWeight: step === s.step ? 600 : 400,
                mb: 0.5,
              }}
            >
              {step === "done" ? "✅" : s.step === step ? "⏳" : "○"} {s.label}
            </Typography>
          ))}
        </>
      )}
    </DialogContent>
  </Dialog>
);

export default PublishLinkedInPanel;
