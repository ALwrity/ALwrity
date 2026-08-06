import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StudioModalCloseButton } from "./dashboard/StudioModalCloseButton";
import type { LinkedInDraftContentType } from "../utils/linkedInDraftLibraryUtils";
import {
  DEFAULT_PROGRESS_CONTENT_TYPE,
  getProgressActiveFooterTip,
  getProgressCompletionFooter,
  getProgressHeaderSubtitle,
  getProgressHeaderTitle,
  getProgressStepEducation,
  resolveProgressContentType,
} from "../utils/linkedInProgressCopy";

type ProgressStatus = "pending" | "active" | "completed" | "error";

export interface ProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
  message?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

interface ProgressTrackerProps {
  steps: ProgressStep[];
  active: boolean;
  /** Effective session content type for progress copy (post vs article). */
  contentType?: LinkedInDraftContentType;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  steps,
  active,
  contentType: contentTypeProp,
}) => {
  const [mounted, setMounted] = useState(false);
  const [userDismissed, setUserDismissed] = useState(false);
  const isOpen = steps && steps.length > 0;
  const sessionKey = useMemo(
    () => steps.map((step) => `${step.id}:${step.status}`).join("|"),
    [steps],
  );

  useEffect(() => {
    setUserDismissed(false);
  }, [sessionKey]);

  const dismiss = () => setUserDismissed(true);

  // Delay mount for entrance animation + lock body scroll while open
  useEffect(() => {
    if (isOpen && !userDismissed) {
      const t = setTimeout(() => setMounted(true), 10);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
    setMounted(false);
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, userDismissed]);

  useEffect(() => {
    if (!isOpen || userDismissed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, userDismissed]);

  if (!steps || steps.length === 0 || userDismissed) return null;

  const completedSteps = steps.filter(
    (step) => step.status === "completed",
  ).length;
  const progressPercentage = Math.round((completedSteps / steps.length) * 100);
  const hasError = steps.some((step) => step.status === "error");
  const contentType = resolveProgressContentType(
    contentTypeProp ?? DEFAULT_PROGRESS_CONTENT_TYPE,
  );

  const subtitle = getProgressHeaderSubtitle({
    active,
    hasError,
    contentType,
  });
  const headerTitle = getProgressHeaderTitle({
    active,
    hasError,
    contentType,
  });
  const completionFooter = getProgressCompletionFooter(contentType);
  const activeFooterTip = getProgressActiveFooterTip(contentType);

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        opacity: mounted ? 1 : 0,
        pointerEvents: "auto",
        transition: "opacity 300ms ease",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          borderRadius: 16,
          background: "rgba(255, 255, 255, 0.97)",
          boxShadow:
            "0 24px 80px rgba(10, 102, 194, 0.18), 0 4px 24px rgba(0, 0, 0, 0.08)",
          border: "1px solid rgba(10, 102, 194, 0.08)",
          transform: mounted
            ? "scale(1) translateY(0)"
            : "scale(0.96) translateY(8px)",
          transition: "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(10, 102, 194, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              {/* Animated AI badge */}
              {active && !hasError && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background:
                      "linear-gradient(135deg, #0a66c2 0%, #7c3aed 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    animation: "pgPulse 2s ease-in-out infinite",
                  }}
                >
                  <span style={{ fontSize: 14 }} role="img" aria-label="AI">
                    ✨
                  </span>
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                {headerTitle}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5 }}>
              {subtitle}
            </div>
          </div>

          {/* Percentage pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: hasError
                  ? "#ef4444"
                  : progressPercentage === 100
                    ? "#10b981"
                    : "#0a66c2",
                padding: "6px 14px",
                background: hasError
                  ? "rgba(239, 68, 68, 0.08)"
                  : progressPercentage === 100
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(10, 102, 194, 0.08)",
                borderRadius: 24,
                whiteSpace: "nowrap",
              }}
            >
              {hasError ? "!" : `${progressPercentage}%`}
            </div>
            <StudioModalCloseButton
              onClick={dismiss}
              ariaLabel="Close progress"
            />
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ padding: "0 24px", marginTop: -1 }}>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercentage}%`,
                borderRadius: 2,
                background: hasError
                  ? "#ef4444"
                  : "linear-gradient(90deg, #0a66c2 0%, #7c3aed 100%)",
                transition: "width 400ms ease",
              }}
            />
          </div>
        </div>

        {/* ── Steps ── */}
        <div
          style={{
            padding: "16px 24px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isActive = step.status === "active";
            const isCompleted = step.status === "completed";
            const isError = step.status === "error";

            return (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: isActive ? "10px 12px" : "8px 12px",
                  borderRadius: 10,
                  background: isActive
                    ? "rgba(10, 102, 194, 0.04)"
                    : "transparent",
                  transition: "all 300ms ease",
                }}
              >
                {/* Indicator + connector */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flexShrink: 0,
                    width: 28,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: isError
                        ? "#ef4444"
                        : isCompleted
                          ? "#10b981"
                          : isActive
                            ? "#0a66c2"
                            : "#e2e8f0",
                      color:
                        isError || isCompleted || isActive
                          ? "white"
                          : "#94a3b8",
                      fontSize: 12,
                      fontWeight: 700,
                      transition: "all 300ms ease",
                      boxShadow: isActive
                        ? "0 0 0 4px rgba(10, 102, 194, 0.12)"
                        : "none",
                    }}
                  >
                    {isCompleted ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M3.5 8.5L7 12L13 4.5"
                          stroke="white"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : isError ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M5 5L11 11M11 5L5 11"
                          stroke="white"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : isActive ? (
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "white",
                          animation: "pgPulse 1.4s ease-in-out infinite",
                        }}
                      />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  {/* Connector */}
                  {!isLast && (
                    <div
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 8,
                        background: isCompleted ? "#10b981" : "#e2e8f0",
                        marginTop: 4,
                        borderRadius: 1,
                        transition: "background 300ms ease",
                      }}
                    />
                  )}
                </div>

                {/* Step content */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingBottom: isLast ? 0 : 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: isActive ? 600 : 500,
                      color: isError
                        ? "#ef4444"
                        : isActive
                          ? "#0a66c2"
                          : isCompleted
                            ? "#0f172a"
                            : "#94a3b8",
                      marginBottom: isActive ? 4 : 0,
                      transition: "color 200ms ease",
                    }}
                  >
                    {step.label}
                  </div>

                  {/* Educational description for active step */}
                  {isActive && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#64748b",
                        lineHeight: 1.55,
                      }}
                    >
                      {getProgressStepEducation(step.id, contentType) ||
                        step.message ||
                        ""}
                    </div>
                  )}

                  {/* Completed message */}
                  {step.message && !isActive && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        lineHeight: 1.45,
                        marginTop: 2,
                      }}
                    >
                      {step.message}
                    </div>
                  )}

                  {/* Details for completed steps */}
                  {step.details && isCompleted && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "6px 10px",
                        background: "rgba(16, 185, 129, 0.06)",
                        borderRadius: 6,
                        fontSize: 11.5,
                        color: "#065f46",
                      }}
                    >
                      {Object.entries(step.details).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 1 }}>
                          <strong>{key}:</strong> {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "12px 24px 20px" }}>
          {active && !hasError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background:
                  "linear-gradient(135deg, rgba(10, 102, 194, 0.04) 0%, rgba(124, 58, 237, 0.03) 100%)",
                borderRadius: 10,
                border: "1px solid rgba(10, 102, 194, 0.06)",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#0a66c2",
                  flexShrink: 0,
                  animation: "pgPulse 1.5s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.5,
                  flex: 1,
                }}
              >
                <strong style={{ color: "#0a66c2" }}>Good to know:</strong>{" "}
                {activeFooterTip}
              </div>
            </div>
          )}

          {hasError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.06)",
                borderRadius: 10,
                border: "1px solid rgba(239, 68, 68, 0.12)",
                fontSize: 12,
                color: "#991b1b",
                lineHeight: 1.5,
              }}
            >
              The generation was interrupted. Please try again — if the problem
              persists, check your API keys or network connection.
            </div>
          )}

          {!active && !hasError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#10b981",
                  padding: "4px 0",
                }}
              >
                {completionFooter}
              </div>
              <button
                type="button"
                onClick={dismiss}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* CSS animations */}
        <style>{`
          @keyframes pgPulse {
            0%, 100% { opacity: 0.5; transform: scale(0.82); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ProgressTracker;
