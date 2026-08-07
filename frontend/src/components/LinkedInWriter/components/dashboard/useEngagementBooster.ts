import { useCallback, useEffect, useState } from "react";
import type { PostPreviewScoreResponse } from "../../../../services/linkedInGrowthApi";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";
import {
  optimizeForEngagement,
  scoreDraftPair,
} from "./engagementBoosterApi";
import { readEngagementBoosterContext } from "./engagementBoosterContext";
import { SCORING_UNAVAILABLE_MSG } from "./engagementBoosterCopy";
import { dispatchReviewOptimisedDraftInStudio } from "./engagementBoosterStudioEvents";
import { readStudioDraft } from "./engagementWedgeDraftUtils";

export type EngagementBoosterStep =
  | "input"
  | "optimising"
  | "scoring"
  | "result";

export interface UseEngagementBoosterResult {
  original: string;
  setOriginal: (value: string) => void;
  optimised: string;
  step: EngagementBoosterStep;
  error: string;
  scoringWarning: string;
  origScore: PostPreviewScoreResponse | null;
  optScore: PostPreviewScoreResponse | null;
  contentType: LinkedInDraftContentType;
  hasPersonaContext: boolean;
  canAccept: boolean;
  handleOptimise: () => Promise<void>;
  handleReviewInEditor: () => void;
  handleEditAgain: () => void;
}

export function useEngagementBooster(
  open: boolean,
  onClose: () => void,
  initialContent?: string,
): UseEngagementBoosterResult {
  const [original, setOriginal] = useState("");
  const [optimised, setOptimised] = useState("");
  const [step, setStep] = useState<EngagementBoosterStep>("input");
  const [error, setError] = useState("");
  const [scoringWarning, setScoringWarning] = useState("");
  const [origScore, setOrigScore] = useState<PostPreviewScoreResponse | null>(
    null,
  );
  const [optScore, setOptScore] = useState<PostPreviewScoreResponse | null>(
    null,
  );
  const [contentType, setContentType] =
    useState<LinkedInDraftContentType>("post");
  const [hasPersonaContext, setHasPersonaContext] = useState(false);

  useEffect(() => {
    if (!open) return;

    const ctx = readEngagementBoosterContext();
    setContentType(ctx.contentType);
    setHasPersonaContext(ctx.hasPersonaContext);
    const seed =
      initialContent?.trim() || readStudioDraft();
    setOriginal(seed);
    setOptimised("");
    setStep("input");
    setError("");
    setScoringWarning("");
    setOrigScore(null);
    setOptScore(null);
  }, [open, initialContent]);

  const handleOptimise = useCallback(async () => {
    const trimmed = original.trim();
    if (!trimmed) {
      setError("Please paste or write your draft first.");
      return;
    }

    const ctx = readEngagementBoosterContext();

    setError("");
    setScoringWarning("");
    setStep("optimising");

    try {
      const optimizeResult = await optimizeForEngagement(trimmed, {
        industry: ctx.industry,
        tone: ctx.tone,
        target_audience: ctx.target_audience,
        contentType: ctx.contentType,
      });

      if (!optimizeResult.success || !optimizeResult.content) {
        setError(
          optimizeResult.error ?? "Optimisation failed. Please try again.",
        );
        setStep("input");
        return;
      }

      setOptimised(optimizeResult.content);
      setStep("scoring");

      const scores = await scoreDraftPair(trimmed, optimizeResult.content);
      setOrigScore(scores.original);
      setOptScore(scores.optimised);

      if (!scores.scoringAvailable) {
        setScoringWarning(SCORING_UNAVAILABLE_MSG);
      } else if (!scores.original || !scores.optimised) {
        setScoringWarning(
          "One preview score could not be loaded. Compare the drafts below.",
        );
      }

      setStep("result");
    } catch (err) {
      console.error("[EngagementBooster] optimise failed", err);
      setError("Optimisation failed. Please try again.");
      setStep("input");
    }
  }, [original]);

  const handleReviewInEditor = useCallback(() => {
    const trimmed = optimised.trim();
    if (!trimmed) return;

    dispatchReviewOptimisedDraftInStudio(original, trimmed, contentType);
    onClose();
  }, [contentType, onClose, optimised, original]);

  const handleEditAgain = useCallback(() => {
    setStep("input");
    setScoringWarning("");
  }, []);

  return {
    original,
    setOriginal,
    optimised,
    step,
    error,
    scoringWarning,
    origScore,
    optScore,
    contentType,
    hasPersonaContext,
    canAccept: optimised.trim().length > 0,
    handleOptimise,
    handleReviewInEditor,
    handleEditAgain,
  };
}
