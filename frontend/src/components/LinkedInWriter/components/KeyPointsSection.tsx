import React, { useState } from "react";
import {
  generateKeyPoints,
  type KeyPointSet,
} from "../../../services/linkedInWriterApi";

interface KeyPointsSectionProps {
  topic: string;
  industry: string;
  tone: string;
  targetAudience: string;
  keyPoints: string;
  onChange: (value: string) => void;
  /** Optional reference post context for AI key-point generation. */
  referenceContext?: string;
}

export const KeyPointsSection: React.FC<KeyPointsSectionProps> = ({
  topic,
  industry,
  tone,
  targetAudience,
  keyPoints,
  onChange,
  referenceContext,
}) => {
  const [phase, setPhase] = useState<"idle" | "generating" | "ready">("idle");
  const [sets, setSets] = useState<KeyPointSet[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    setErrorMsg(null);
    setPhase("generating");
    try {
      const payload = {
        topic: topic.trim(),
        industry: industry || undefined,
        tone: tone || undefined,
        target_audience: targetAudience || undefined,
        brainstorm_context: [referenceContext?.trim(), keyPoints?.trim()]
          .filter(Boolean)
          .join("\n\n") || undefined,
      };
      const res = await generateKeyPoints(payload);
      if (res.success && res.data?.key_point_sets?.length) {
        setSets(res.data.key_point_sets);
        setPhase("ready");
      } else {
        setErrorMsg(
          res?.error || "No key points returned. Try a different topic.",
        );
        setPhase("idle");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(msg);
      setPhase("idle");
    }
  };

  const handleSelectSet = (kps: KeyPointSet) => {
    onChange(kps.points.join(" / "));
    setPhase("idle");
    setSets([]);
    setErrorMsg(null);
  };

  const handleBack = () => {
    setPhase("idle");
    setSets([]);
    setErrorMsg(null);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          marginBottom: 4,
          fontWeight: 600,
          fontSize: 13,
          color: "#374151",
        }}
      >
        Key Points
      </label>
      {phase === "ready" ? (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280" }}>
            Choose the angle that fits your post best:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sets.map((kps) => (
              <div
                key={kps.id}
                onClick={() => handleSelectSet(kps)}
                style={{
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "11px 14px",
                  cursor: "pointer",
                  background: "#fff",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#8b5cf6";
                  e.currentTarget.style.boxShadow =
                    "0 1px 6px rgba(139,92,246,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {kps.id}
                  </span>
                  <span
                    style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}
                  >
                    {kps.title}
                  </span>
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12,
                    color: "#4b5563",
                    lineHeight: 1.6,
                  }}
                >
                  {kps.points.map((p, pi) => (
                    <li key={pi}>{p}</li>
                  ))}
                </ul>
                <div
                  style={{
                    marginTop: 7,
                    fontSize: 11.5,
                    color: "#8b5cf6",
                    fontWeight: 600,
                    fontStyle: "italic",
                  }}
                >
                  💡 {kps.reason_to_choose}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleBack}
            style={{
              marginTop: 8,
              padding: "5px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
            }}
          >
            ← Back to manual entry
          </button>
        </div>
      ) : (
        <div className="linkedin-quick-create-field-card">
          <textarea
            value={keyPoints}
            onChange={(e) => {
              onChange(e.target.value);
              setErrorMsg(null);
            }}
            placeholder="Key point 1 / Key point 2 / Key point 3"
            rows={3}
            className="linkedin-quick-create-field-card__textarea"
          />
          <div className="linkedin-quick-create-field-card__actions">
            {phase === "generating" ? (
              <div className="linkedin-quick-create-field-card__generating">
                <div className="linkedin-quick-create-field-card__spinner" />
                Generating...
              </div>
            ) : (
              <button
                type="button"
                disabled={!topic.trim()}
                onClick={handleGenerate}
                className={`linkedin-quick-create-field-card__btn linkedin-quick-create-field-card__btn--keypoints${!topic.trim() ? " linkedin-quick-create-field-card__btn--disabled" : ""}`}
              >
                ✨ Get Key Points
              </button>
            )}
          </div>
          {errorMsg && (
            <p className="linkedin-quick-create-field-card__error">⚠ {errorMsg}</p>
          )}
        </div>
      )}
    </div>
  );
};
