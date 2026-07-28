import React from "react";

interface AnalysisStepIndicatorProps {
  steps: string[];
  /** Milliseconds between step advances (default 3000). */
  stepIntervalMs?: number;
}

/**
 * Animated checklist used while LinkedIn profile/topic analysis runs.
 * Reused by profile optimization and topic recommendations refresh flows.
 */
export const AnalysisStepIndicator: React.FC<AnalysisStepIndicatorProps> = ({
  steps,
  stepIntervalMs = 3000,
}) => {
  const [activeStep, setActiveStep] = React.useState(0);

  React.useEffect(() => {
    setActiveStep(0);
    const interval = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, steps.length - 1));
    }, stepIntervalMs);
    return () => window.clearInterval(interval);
  }, [steps, stepIntervalMs]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}
      aria-live="polite"
    >
      {steps.map((label, index) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: index <= activeStep ? "#0A66C2" : "#d1d5db",
            fontWeight: index <= activeStep ? 600 : 400,
            transition: "color 0.4s",
          }}
        >
          <span style={{ width: 16, textAlign: "center" }} aria-hidden>
            {index < activeStep ? "✓" : index === activeStep ? "●" : "○"}
          </span>
          {label}
        </div>
      ))}
    </div>
  );
};
