import React, { useState } from "react";
import { ProgressTracker } from "./components/ProgressTracker";

type ProgressStatus = "pending" | "active" | "completed" | "error";

interface TestProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
  message?: string;
}

// Test component to verify enhanced progress tracking
export const TestEnhancedProgress: React.FC = () => {
  const [testSteps, setTestSteps] = useState<TestProgressStep[]>([
    {
      id: "personalize",
      label: "Personalizing topic & context",
      status: "pending",
    },
    {
      id: "prepare_queries",
      label: "Preparing research queries",
      status: "pending",
    },
    {
      id: "research",
      label: "Conducting research & analysis",
      status: "pending",
    },
    { id: "grounding", label: "Applying AI grounding", status: "pending" },
    {
      id: "content_generation",
      label: "Generating content",
      status: "pending",
    },
    { id: "citations", label: "Extracting citations", status: "pending" },
    { id: "quality_analysis", label: "Quality assessment", status: "pending" },
    { id: "finalize", label: "Finalizing & optimizing", status: "pending" },
  ]);

  const [isActive, setIsActive] = useState(false);

  const startTest = () => {
    setIsActive(true);
    setTestSteps((prev) =>
      prev.map((step, index) =>
        index === 0
          ? {
              ...step,
              status: "active",
              message:
                "Analyzing topic, industry context, and target audience...",
            }
          : step,
      ),
    );

    // Simulate progress updates
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < testSteps.length) {
        setTestSteps((prev) => {
          const updated = [...prev];
          // Mark current step as completed
          if (currentStep > 0) {
            updated[currentStep - 1] = {
              ...updated[currentStep - 1],
              status: "completed",
              message: getCompletionMessage(currentStep - 1),
            };
          }
          // Mark next step as active
          if (currentStep < updated.length) {
            updated[currentStep] = {
              ...updated[currentStep],
              status: "active",
              message: getActiveMessage(currentStep),
            };
          }
          return updated;
        });
        currentStep++;
      } else {
        clearInterval(interval);
        setIsActive(false);
        // Mark all as completed
        setTestSteps((prev) =>
          prev.map((step) => ({
            ...step,
            status: "completed",
            message: getCompletionMessage(
              testSteps.findIndex((s) => s.id === step.id),
            ),
          })),
        );
      }
    }, 1500);
  };

  const getActiveMessage = (stepIndex: number): string => {
    const messages = [
      "Analyzing topic, industry context, and target audience...",
      "Preparing research queries for content generation...",
      "Conducting research and analyzing industry trends...",
      "Applying AI grounding for enhanced accuracy...",
      "Generating content with industry insights...",
      "Extracting citations and references...",
      "Assessing content quality and relevance...",
      "Finalizing and optimizing content...",
    ];
    return messages[stepIndex] || "Processing...";
  };

  const getCompletionMessage = (stepIndex: number): string => {
    const messages = [
      "Topic personalized successfully",
      "Research queries prepared",
      "Research completed with industry insights",
      "AI grounding applied successfully",
      "Content generated with professional quality",
      "Citations extracted and formatted",
      "Quality assessment completed",
      "Content finalized and optimized",
    ];
    return messages[stepIndex] || "Step completed";
  };

  const resetTest = () => {
    setTestSteps((prev) =>
      prev.map((step) => ({
        ...step,
        status: "pending" as const,
        message: undefined,
      })),
    );
    setIsActive(false);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h2 style={{ color: "#0f172a", marginBottom: "20px" }}>
        Enhanced LinkedIn Progress Tracker Test
      </h2>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={startTest}
          disabled={isActive}
          style={{
            padding: "10px 20px",
            background: isActive ? "#cbd5e1" : "#0a66c2",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isActive ? "not-allowed" : "pointer",
            marginRight: "10px",
          }}
        >
          {isActive ? "Running..." : "Start Progress Test"}
        </button>

        <button
          onClick={resetTest}
          style={{
            padding: "10px 20px",
            background: "#64748b",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Reset Test
        </button>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "16px",
          background: "#f8f9fa",
          borderRadius: "8px",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", color: "#374151" }}>
          Test Description:
        </h3>
        <p style={{ margin: 0, color: "#6b7280", lineHeight: "1.5" }}>
          This test demonstrates the enhanced LinkedIn progress tracker with
          detailed messages, progress percentages, and improved visual design.
          The tracker now shows informative messages for each step, making it
          easier for users to understand what's happening during content
          generation.
        </p>
      </div>

      <ProgressTracker steps={testSteps} active={isActive} />
    </div>
  );
};

export default TestEnhancedProgress;
