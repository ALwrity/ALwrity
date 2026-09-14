/**
 * Status bar while Enhance Topic with AI is in flight.
 * Same PlanStatusProgressPanel chrome as Generate Pitch.
 */

import React, { useEffect, useState } from "react";
import { PlanStatusProgressPanel } from "./PlanStatusProgressPanel";
import { PLAN_GENERATION_LOADER_INTERVAL_MS, planGenerationProgressPercent } from "../utils/youtubePlanGenerationLoader";
import { getYouTubePlanIdeaEnhanceLoaderCopy } from "../utils/youtubePlanIdeaEnhanceLoader";

export const YouTubePlanIdeaEnhanceProgressPanel: React.FC = () => {
  const { messages, steps } = getYouTubePlanIdeaEnhanceLoaderCopy();
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);

  useEffect(() => {
    setLoaderMessageIndex(0);
    console.info("[YouTubePlanIdeaEnhanceProgressPanel] Status started", {
      stepCount: messages.length,
    });
    const intervalId = window.setInterval(() => {
      setLoaderMessageIndex((idx) => Math.min(idx + 1, messages.length - 1));
    }, PLAN_GENERATION_LOADER_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      console.info("[YouTubePlanIdeaEnhanceProgressPanel] Status stopped");
    };
  }, [messages.length]);

  const safeIndex = Math.min(loaderMessageIndex, messages.length - 1);
  const message = messages[safeIndex];
  const progress = planGenerationProgressPercent(safeIndex, messages.length);

  return (
    <PlanStatusProgressPanel
      title="Enhancing topic"
      message={message}
      progress={progress}
      steps={steps}
      hint="This can take about a minute. The bar follows typical steps, not a live server percentage."
    />
  );
};
