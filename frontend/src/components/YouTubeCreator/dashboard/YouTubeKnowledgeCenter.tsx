import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { YouTubeActionModal } from "./YouTubeActionModal";
import { YouTubeRailIconButton } from "./YouTubeRailIconButton";
import {
  YOUTUBE_ASK_FAQ,
  YOUTUBE_KNOWLEDGE_CENTER_FEATURES,
  type YouTubeKnowledgeFeature,
} from "./knowledgeCenterFeatures";
import { openYouTubeCreator, openYouTubeWorkflowWedge, openYouTubeChannelBible } from "./youtubeStudioEvents";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { YT_Z_KNOWLEDGE_CENTER } from "./youtubeStudioZIndex";

interface YouTubeKnowledgeCenterProps {
  compact?: boolean;
  /** rail = desktop dock; mobileCircle = landing icon row */
  variant?: "rail" | "mobileCircle";
}

export const YouTubeKnowledgeCenter: React.FC<YouTubeKnowledgeCenterProps> = ({
  compact = false,
  variant = "rail",
}) => {
  const isMobileCircle = variant === "mobileCircle";
  const [expanded, setExpanded] = useState(false);
  const [gridPos, setGridPos] = useState<{ bottom: number; right: number; width: number } | null>(
    null,
  );
  const [askOpen, setAskOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<YouTubeKnowledgeFeature | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const features = useMemo(
    () =>
      YOUTUBE_KNOWLEDGE_CENTER_FEATURES.filter((f) =>
        compact && !isMobileCircle
          ? ["ask-alwrity", "quick-start", "studio-guide"].includes(f.id)
          : true,
      ),
    [compact, isMobileCircle],
  );

  const updateGridPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(720, window.innerWidth - 32);
    const right = Math.max(16, window.innerWidth - rect.right);
    setGridPos({
      bottom: Math.max(16, window.innerHeight - rect.top + 8),
      right,
      width,
    });
  }, []);

  useEffect(() => {
    if (!expanded || isMobileCircle) return undefined;
    updateGridPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if ((event.target as Element).closest?.(".yt-knowledge-center-portal")) return;
      setExpanded(false);
    };
    window.addEventListener("resize", updateGridPosition);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("resize", updateGridPosition);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [expanded, updateGridPosition, isMobileCircle]);

  const handleAction = (feature: YouTubeKnowledgeFeature) => {
    setExpanded(false);
    switch (feature.action) {
      case "askAlwrity":
        setAskOpen(true);
        setAnswer(null);
        break;
      case "quickStart":
        openYouTubeWorkflowWedge({ wedge: "plan" });
        break;
      case "channelBible":
        openYouTubeChannelBible();
        break;
      case "multimodal":
        openYouTubeCreator({ step: 0 });
        break;
      default:
        setInfoOpen(feature);
    }
  };

  const handleAsk = () => {
    const q = question.trim().toLowerCase();
    if (!q) return;
    const hit = YOUTUBE_ASK_FAQ.find(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        q.split(" ").some((w) => w.length > 3 && f.a.toLowerCase().includes(w)),
    );
    setAnswer(
      hit?.a ||
        "Great question. Use Plan to pick a niche idea, Create to draft with HITL review, Publish only after you approve title & privacy, then check Analysis weekly. For channel-specific coaching, open Video Creator with your Channel Bible applied.",
    );
  };

  const panel = (
    <div className="yt-knowledge-center-panel">
      <div className="yt-knowledge-center-panel-header">
        <h3 className="yt-knowledge-center-panel-title">Knowledge Centre</h3>
        <button
          type="button"
          className="yt-modal-close"
          aria-label="Close Knowledge Centre"
          onClick={() => setExpanded(false)}
        >
          ×
        </button>
      </div>
      <div className="yt-kc-grid">
        {features.map((feature) => (
          <button
            key={feature.id}
            type="button"
            className="yt-kc-item"
            onClick={() => handleAction(feature)}
          >
            <span aria-hidden>{feature.icon}</span>
            <span>
              <div className="yt-kc-item-title">{feature.title}</div>
              <div className="yt-kc-item-desc">{feature.description}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {isMobileCircle ? (
        <button
          type="button"
          className="yt-mobile-analytics-icon-btn"
          data-tour="yt-mobile-knowledge-icon"
          onClick={() => {
            console.info("[YouTubeKnowledgeCenter] Open mobile Knowledge Centre");
            setExpanded(true);
          }}
          aria-label="Knowledge centre"
          aria-expanded={expanded}
          title="Knowledge Centre"
        >
          <span className="yt-mobile-analytics-icon-btn-circle" aria-hidden>
            <MenuBookIcon fontSize="medium" />
          </span>
          <span className="yt-mobile-analytics-icon-btn-label">Knowledge centre</span>
        </button>
      ) : (
        <>
          {expanded &&
            gridPos &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="yt-knowledge-center-portal"
                style={{
                  position: "fixed",
                  bottom: gridPos.bottom,
                  right: gridPos.right,
                  width: gridPos.width,
                  zIndex: YT_Z_KNOWLEDGE_CENTER,
                }}
              >
                {panel}
              </div>,
              document.body,
            )}
          <div ref={anchorRef} className="yt-knowledge-center-rail" data-tour="yt-knowledge-center">
            <YouTubeRailIconButton
              label="Knowledge Centre"
              icon="knowledge"
              onClick={() => setExpanded((open) => !open)}
              open={expanded}
              ariaExpanded={expanded}
            />
          </div>
        </>
      )}
      {isMobileCircle && (
        <YouTubeActionModal
          open={expanded}
          title="Knowledge Centre"
          onClose={() => setExpanded(false)}
          maxWidth={440}
        >
          <div className="yt-mobile-analytics-knowledge-grid">
            {features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                className="yt-mobile-analytics-knowledge-feature"
                onClick={() => handleAction(feature)}
                style={{ ["--feature-accent" as string]: feature.accent }}
              >
                <span aria-hidden>{feature.icon}</span>
                <span className="yt-mobile-analytics-knowledge-feature-title">
                  {feature.title}
                </span>
              </button>
            ))}
          </div>
        </YouTubeActionModal>
      )}
      <YouTubeActionModal
        open={askOpen}
        title="Ask ALwrity"
        intro="Curated YouTube answers + your free-text questions."
        onClose={() => setAskOpen(false)}
        maxWidth={560}
      >
        <div className="yt-kc-ask">
          {YOUTUBE_ASK_FAQ.map((faq) => (
            <details key={faq.q} className="yt-kc-faq">
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about growing your YouTube channel with ALwrity…"
            rows={3}
          />
          <button type="button" className="yt-rail-btn yt-rail-btn--primary" onClick={handleAsk}>
            Ask ALwrity
          </button>
          {answer && <p className="yt-modal-intro">{answer}</p>}
        </div>
      </YouTubeActionModal>
      <YouTubeActionModal
        open={!!infoOpen}
        title={infoOpen?.title || ""}
        intro={infoOpen?.description}
        onClose={() => setInfoOpen(null)}
        maxWidth={480}
      >
        <p className="yt-modal-intro">
          ALwrity is AI-first and HITL: we draft, you decide. Use the radial wedges daily to plan,
          create, publish, analyse, engage, and remarket — like a thought-leader studio for SMEs.
        </p>
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          onClick={() => {
            setInfoOpen(null);
            openYouTubeWorkflowWedge({ wedge: "plan" });
          }}
        >
          Start with Plan
        </button>
      </YouTubeActionModal>
    </>
  );
};
