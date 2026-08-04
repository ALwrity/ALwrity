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
import {
  Image as ImageIcon,
  LinkedIn as LinkedInIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useLinkedInSocialConnection } from "../../../hooks/useLinkedInSocialConnection";
import { getLinkedInPublishErrorMessage } from "../../../api/linkedinSocial";
import { useLinkedInPublishMedia } from "../hooks/useLinkedInPublishMedia";
import { useLinkedInSelectionImage } from "../hooks/useLinkedInSelectionImage";
import { LinkedInPublishMediaSection } from "./LinkedInPublishMediaSection";
import { LinkedInSelectionImageModal } from "./LinkedInSelectionImageModal";
import { LinkedInPublishPreviewPlain } from "./LinkedInPublishPreviewPlain";
import { LinkedInPublishChecklist } from "./LinkedInPublishChecklist";
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
  formatCharCountLabel,
  getCharReadiness,
  getPublishPlainText,
  getSeeMoreCaption,
} from "../utils/linkedInPublishReadiness";

interface PublishLinkedInPanelProps {
  draft: string;
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
  const [mediaAnchor, setMediaAnchor] = useState<HTMLElement | null>(null);
  const prefs = readPrefs();

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
  const chars = getCharReadiness(publishContent);
  const seeMoreCaption = getSeeMoreCaption(chars);
  const draftHasImage = Boolean(getLastDraftImageForPublish(draft));
  const hasPublishMedia = publishMedia.hasAttachment || draftHasImage;
  const previewAttachment = resolvePublishMediaAttachment(
    draft,
    publishMedia.attachment,
  );
  const isOrgTarget = selectedTarget === "organization";
  const hardChecksOk = areHardPublishChecksOk(publishContent);
  const canPublish =
    connected && hardChecksOk && !isOrgTarget && !isPublishing && !isLoading;

  const connectionLabel = connected
    ? `Connected via ${provider}`
    : "Not connected — connect LinkedIn to publish";

  const handlePublish = async () => {
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

  const charCaption = (
    <Tooltip
      title={
        seeMoreCaption
          ? "Posts over ~1,300 characters show a \"see more\" cut-off on LinkedIn. Your hook and first 2 lines should capture attention before the fold."
          : `${chars.count} / 3,000 LinkedIn character limit`
      }
      arrow
      placement="top"
    >
      <Typography
        variant="caption"
        sx={{
          color: chars.hardOk ? "#64748b" : "#dc2626",
          display: "block",
          whiteSpace: "nowrap",
          cursor: "help",
        }}
      >
        {formatCharCountLabel(chars.count)}
        {seeMoreCaption ? " · see more" : ""}
      </Typography>
    </Tooltip>
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

        {mediaControls}
        {charCaption}
        <Tooltip title={connected ? 'Publish to LinkedIn' : 'Connect your LinkedIn account to publish posts'} arrow>
          <span>
            <Button
              variant="contained"
              disabled={isPublishing || isConnecting || (connected && !hardChecksOk)}
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
              {isPublishing ? 'Publishing...' : isConnecting ? 'Connecting...' : connected ? 'Publish' : 'Connect'}
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
        Publish your draft text to your LinkedIn personal profile with optional
        image attachment.
      </Typography>

      <LinkedInPublishMediaSection
        draft={draft}
        topic={topic}
        media={publishMedia}
        selectionImage={selectionImage}
        renderImageModal={false}
      />

      <Box sx={{ mb: 1.5 }}>
        <LinkedInPublishPreviewPlain
          draft={draft}
          attachment={previewAttachment}
          forPublish
        />
      </Box>

      <Box sx={{ mb: 1.5 }}>
        <LinkedInPublishChecklist
          draft={publishContent}
          hasMedia={hasPublishMedia}
          compact
        />
        <Typography
          variant="caption"
          sx={{
            color: chars.hardOk ? "#64748b" : "#dc2626",
            display: "block",
            mt: 1,
          }}
        >
          {formatCharCountLabel(chars.count)}
          {seeMoreCaption ? ` · ${seeMoreCaption}` : ""}
        </Typography>
      </Box>

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

      <Tooltip title={connected ? 'Publish to LinkedIn' : 'Connect your LinkedIn account to publish posts'} arrow>
        <span>
          <Button
            variant="contained"
            disabled={isPublishing || isConnecting || (connected && !hardChecksOk)}
            onClick={connected ? handlePublish : () => { void connectWithOAuth(); }}
            startIcon={
              isPublishing || isConnecting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
            sx={{ bgcolor: "#0A66C2", "&:hover": { bgcolor: "#004182" } }}
          >
            {isPublishing ? 'Publishing...' : isConnecting ? 'Connecting...' : connected ? 'Publish' : 'Connect'}
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
