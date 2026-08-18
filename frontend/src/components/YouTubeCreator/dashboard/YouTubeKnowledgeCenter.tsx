import React, { useMemo, useState } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";
import {
  YOUTUBE_ASK_FAQ,
  YOUTUBE_KNOWLEDGE_CENTER_FEATURES,
  type YouTubeKnowledgeFeature,
} from "./knowledgeCenterFeatures";
import { openYouTubeCreator, openYouTubeWorkflowWedge } from "./youtubeStudioEvents";

interface YouTubeKnowledgeCenterProps {
  compact?: boolean;
}

export const YouTubeKnowledgeCenter: React.FC<YouTubeKnowledgeCenterProps> = ({
  compact = false,
}) => {
  const [askOpen, setAskOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<YouTubeKnowledgeFeature | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const features = useMemo(() => YOUTUBE_KNOWLEDGE_CENTER_FEATURES, []);

  const handleAction = (feature: YouTubeKnowledgeFeature) => {
    switch (feature.action) {
      case "askAlwrity":
        setAskOpen(true);
        setAnswer(null);
        break;
      case "quickStart":
        openYouTubeWorkflowWedge({ wedge: "plan" });
        break;
      case "channelBible":
      case "multimodal":
        openYouTubeCreator({ step: 0 });
        break;
      case "persona":
      case "studioGuide":
      case "bestPractices":
        setInfoOpen(feature);
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

  return (
    <div className="yt-rail-panel" data-tour="yt-knowledge-center">
      <h3>Knowledge Centre</h3>
      <div className="yt-kc-grid">
        {features
          .filter((f) => (compact ? ["ask-alwrity", "quick-start", "studio-guide"].includes(f.id) : true))
          .map((feature) => (
            <button
              key={feature.id}
              type="button"
              className="yt-kc-item"
              onClick={() => handleAction(feature)}
            >
              <span aria-hidden>{feature.icon}</span>
              <span>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{feature.title}</div>
                <div style={{ fontSize: 11, color: "#606060", lineHeight: 1.35 }}>
                  {feature.description}
                </div>
              </span>
            </button>
          ))}
      </div>

      <YouTubeActionModal
        open={askOpen}
        title="Ask ALwrity"
        intro="Curated YouTube answers + your free-text questions."
        onClose={() => setAskOpen(false)}
        maxWidth={560}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {YOUTUBE_ASK_FAQ.map((faq) => (
            <details key={faq.q} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 10 }}>
              <summary style={{ fontWeight: 700, cursor: "pointer" }}>{faq.q}</summary>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#606060" }}>{faq.a}</p>
            </details>
          ))}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about growing your YouTube channel with ALwrity…"
            rows={3}
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid #e5e5e5",
              padding: 10,
              fontFamily: "inherit",
              resize: "vertical",
            }}
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
    </div>
  );
};
