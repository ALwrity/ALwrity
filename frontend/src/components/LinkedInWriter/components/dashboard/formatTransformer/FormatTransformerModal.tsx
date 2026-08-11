/**
 * R2 — Format Transformer (Remarket wedge).
 * Transforms current draft → Article / Carousel / Video Script.
 */
import React, { useEffect, useState } from "react";
import { DashboardActionModal } from "../DashboardActionModal";
import { ConnectLockIcon } from "../ConnectLockIcon";
import {
  linkedInWriterApi,
  saveLinkedInToAssetLibrary,
  type CarouselSlide,
} from "../../../../../services/linkedInWriterApi";
import { colors } from "../../GrowthEngine/styles";
import {
  WEDGE_BACK_LABELS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "../wedgeModalUi";
import {
  RemarkWedgeErrorBanner as ErrorBanner,
  RemarkWedgeSavedBadge as SavedBadge,
  RemarkWedgeSpinner as Spinner,
} from "../remarkWedgeShared/remarkWedgeSharedUi";
import {
  FORMAT_TRANSFORMER_LOCKED_HINT,
  FORMAT_TRANSFORMER_OPTIONS,
  isFormatTransformerLocked,
  type FormatTransformerOption,
} from "./formatTransformerFormats";

const DRAFT_KEY = "alwrity-copilot-draft-content";

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function pushDraftToStudio(text: string) {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:updateDraft", { detail: text }),
  );
}

type FormatType = FormatTransformerOption["type"];

interface FormatTransformerModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}

export const FormatTransformerModal: React.FC<FormatTransformerModalProps> = ({
  open,
  onClose,
  onBack,
}) => {
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState<FormatType | null>(null);
  const [result, setResult] = useState<{
    type: FormatType;
    content: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(readDraft());
    setResult(null);
    setError("");
    setSaved(false);
  }, [open]);

  const handleTransform = async (type: FormatType) => {
    if (isFormatTransformerLocked(type)) return;
    if (!draft.trim()) {
      setError("Please write or paste a post first.");
      return;
    }
    setGenerating(type);
    setError("");
    setResult(null);
    try {
      const topic = draft.slice(0, 80).replace(/\n/g, " ").trim();
      let content = "";
      let title = "";

      if (type === "article") {
        const res = await linkedInWriterApi.generateArticle({
          topic,
          industry: "",
          key_sections: [draft],
        });
        if (!res.success || !res.data)
          throw new Error(res.error ?? "Generation failed");
        title = res.data.title;
        content = `# ${res.data.title}\n\n${res.data.content}`;
      } else if (type === "carousel") {
        const res = await linkedInWriterApi.generateCarousel({
          topic,
          industry: "",
          key_takeaways: [draft],
        });
        if (!res.success || !res.data)
          throw new Error(res.error ?? "Generation failed");
        title = res.data.title;
        content = [
          `# ${res.data.title}`,
          ...(res.data.slides ?? []).map(
            (s: CarouselSlide) =>
              `**Slide ${s.slide_number}: ${s.title}**\n${s.content}`,
          ),
        ].join("\n\n");
      } else {
        const res = await linkedInWriterApi.generateVideoScript({
          topic,
          industry: "",
          key_messages: [draft],
        });
        if (!res.success || !res.data)
          throw new Error(res.error ?? "Generation failed");
        title = "Video Script";
        content = [
          `🎬 Hook: ${res.data.hook}`,
          "",
          res.data.main_content
            .map((s: Record<string, string>, i: number) =>
              `Scene ${i + 1}: ${JSON.stringify(s)}`,
            )
            .join("\n"),
          "",
          `✅ Conclusion: ${res.data.conclusion}`,
          "",
          `📝 Description: ${res.data.video_description}`,
        ].join("\n");
      }
      setResult({ type, content, title });
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Generation failed. Please try again.";
      setError(message);
    } finally {
      setGenerating(null);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await saveLinkedInToAssetLibrary({
        title: result.title || "Transformed Content",
        content: result.content,
        topic: result.title,
        tags: [result.type],
      });
      setSaved(true);
    } catch {
      setError("Could not save to library.");
    }
  };

  const fmt = FORMAT_TRANSFORMER_OPTIONS.find((f) => f.type === result?.type);

  return (
    <DashboardActionModal
      open={open}
      title="Format Transformer"
      onClose={onClose}
      onBack={onBack}
      {...wedgePostSizeSubModalProps(WEDGE_BACK_LABELS.remarket)}
      modalClassName={wedgePostSizeModalClassName()}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Transform your post or draft into a completely different format.
        Auto-fills from your current draft.
      </p>

      {!result && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMedium,
              marginBottom: 6,
            }}
          >
            Your Post / Draft
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your post here, or open the editor first to auto-fill…"
            style={{
              width: "100%",
              minHeight: 100,
              padding: "9px 11px",
              borderRadius: 8,
              border: `1.5px solid ${colors.border}`,
              fontSize: 12,
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.6,
              color: colors.textBody,
              boxSizing: "border-box",
              marginBottom: 12,
            }}
          />

          {error && <ErrorBanner msg={error} />}

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMedium,
              marginBottom: 8,
            }}
          >
            Transform to:
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {FORMAT_TRANSFORMER_OPTIONS.map((f) => {
              const locked = Boolean(f.locked);
              const isGenerating = generating === f.type;
              const draftReady = draft.trim().length > 0;
              const disabled = locked || !!generating || !draftReady;

              return (
                <button
                  key={f.type}
                  type="button"
                  disabled={disabled}
                  title={locked ? FORMAT_TRANSFORMER_LOCKED_HINT : undefined}
                  aria-disabled={locked}
                  onClick={() => {
                    if (!locked) void handleTransform(f.type);
                  }}
                  style={{
                    padding: "14px 10px",
                    background: locked
                      ? "#f3f4f6"
                      : isGenerating
                        ? f.accent
                        : `${f.accent}15`,
                    border: locked
                      ? "2px solid #d1d5db"
                      : `2px solid ${isGenerating ? f.accent : `${f.accent}55`}`,
                    borderRadius: 10,
                    cursor: locked ? "not-allowed" : draftReady ? "pointer" : "default",
                    opacity: locked ? 0.88 : !draftReady ? 0.5 : 1,
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: locked
                        ? "#9ca3af"
                        : isGenerating
                          ? "#fff"
                          : f.accent,
                      marginBottom: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    }}
                  >
                    {f.label}
                    {locked && <ConnectLockIcon size={12} />}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: locked
                        ? "#9ca3af"
                        : isGenerating
                          ? "#ffffffcc"
                          : colors.textTertiary,
                      lineHeight: 1.3,
                    }}
                  >
                    {f.desc}
                  </div>
                  {isGenerating && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: "#fff",
                      }}
                    >
                      <Spinner /> Generating…
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {result && fmt && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>{fmt.icon}</span>
            <div
              style={{ fontWeight: 700, fontSize: 14, color: colors.textDark }}
            >
              {result.title || fmt.label}
            </div>
            {saved && <SavedBadge />}
          </div>

          <div
            style={{
              background: colors.rowBg,
              border: `1.5px solid ${fmt.accent}44`,
              borderLeft: `4px solid ${fmt.accent}`,
              borderRadius: 8,
              padding: "12px 14px",
              maxHeight: 280,
              overflowY: "auto",
              fontSize: 12,
              color: colors.textBody,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              marginBottom: 12,
            }}
          >
            {result.content}
          </div>

          {error && <ErrorBanner msg={error} />}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                pushDraftToStudio(result.content);
                onClose();
              }}
              style={{
                flex: 1,
                padding: "9px",
                background: fmt.accent,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✏️ Edit in Studio
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saved}
              style={{
                padding: "9px 16px",
                background: saved ? "#dcfce7" : "none",
                color: saved ? "#166534" : colors.textSecondary,
                border: `1.5px solid ${saved ? "#86efac" : colors.border}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: saved ? "default" : "pointer",
              }}
            >
              {saved ? "✓ Saved" : "💾 Save to Library"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setSaved(false);
              }}
              style={{
                padding: "9px 14px",
                background: "none",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 12,
                color: colors.textTertiary,
                cursor: "pointer",
              }}
            >
              ↩ Try Another
            </button>
          </div>
        </>
      )}
    </DashboardActionModal>
  );
};
