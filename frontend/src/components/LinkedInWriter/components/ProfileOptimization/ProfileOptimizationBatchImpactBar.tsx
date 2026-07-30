import React from "react";
import { Tooltip } from "@mui/material";

import type { LinkedInProfileOptimizationMeta } from "../../../../api/linkedinSocial";
import type { LinkedInProfileOptimizationItem } from "../../../../api/linkedinSocial";
import { computeBatchImpactProjection } from "./profileOptimizationImpact";
import { SectionScoresPanel } from "./SectionScoresPanel";

interface ProfileOptimizationBatchImpactBarProps {
  recommendations: LinkedInProfileOptimizationItem[];
  optimizationMeta?: LinkedInProfileOptimizationMeta | null;
  profileStrengthPercent?: number | null;
  sectionScores?: Record<string, number> | null;
  activeSectionKeys?: Set<string> | null;
  activeSectionCount?: Map<string, number> | null;
  /** Full-width card inside the suggestions stack. */
  stackCard?: boolean;
  /** When true, session label is rendered by the parent stack header. */
  hideSessionLabel?: boolean;
  /** Shown at top of stack impact card (e.g. Batch 1). */
  batchLabel?: string;
  /** Gain hint pill beside batch label in stack card. */
  batchGainHint?: string;
}

export const ProfileOptimizationBatchImpactBar: React.FC<
  ProfileOptimizationBatchImpactBarProps
> = ({
  recommendations,
  optimizationMeta,
  profileStrengthPercent,
  sectionScores = null,
  activeSectionKeys = null,
  activeSectionCount = null,
  stackCard = false,
  hideSessionLabel = false,
  batchLabel,
  batchGainHint,
}) => {
  const batchIndex = (optimizationMeta?.active_batch_index ?? 0) + 1;
  const count = recommendations.length;
  const sessionLabel =
    count > 0
      ? `${count} suggestion${count === 1 ? "" : "s"} · Batch ${batchIndex}`
      : "Review your profile";

  const projection = computeBatchImpactProjection(
    profileStrengthPercent,
    recommendations,
  );
  const showSections = Boolean(
    sectionScores && Object.keys(sectionScores).length > 0,
  );

  if (count === 0) return null;

  const stackMeta =
    stackCard && (batchLabel || projection.gainPoints > 0) ? (
      <div className="profile-opt-batch-impact__stack-meta">
        {batchLabel && (
          <span
            className="profile-opt-batch-impact__stack-batch"
            aria-label="Current batch"
          >
            {batchLabel}
          </span>
        )}
        {projection.gainPoints > 0 && (
          <Tooltip
            title={
              batchGainHint ||
              `+${projection.gainPoints}% profile strength if you apply Suggestions`
            }
            arrow
            placement="top"
          >
            <span
              className="profile-opt-batch-impact__stack-gain"
              role="status"
            >
              +{projection.gainPoints}%
            </span>
          </Tooltip>
        )}
      </div>
    ) : null;

  const impactMeters = (
    <>
      {!hideSessionLabel && (
        <div className="profile-opt-batch-impact__head">
          <p
            id="profile-opt-batch-impact-title"
            className="profile-opt-batch-impact__session"
          >
            {sessionLabel}
          </p>
          {projection.gainPoints > 0 && (
            <span
              className="profile-opt-batch-impact__gain-badge"
              role="status"
            >
              +{projection.gainPoints}%
            </span>
          )}
        </div>
      )}

      <div
        className="profile-opt-batch-impact__chart"
        role="img"
        aria-label="Profile strength projection"
      >
        <div className="profile-opt-batch-impact__meter-row">
          <span className="profile-opt-batch-impact__meter-label">Now</span>
          <div className="profile-opt-batch-impact__track">
            <div
              className="profile-opt-batch-impact__fill profile-opt-batch-impact__fill--current"
              style={{ width: `${projection.currentPercent}%` }}
            />
          </div>
          <span className="profile-opt-batch-impact__value">
            {projection.currentPercent}%
          </span>
        </div>
        <div className="profile-opt-batch-impact__meter-row">
          <span className="profile-opt-batch-impact__meter-label">After</span>
          <div className="profile-opt-batch-impact__track">
            <div
              className="profile-opt-batch-impact__fill profile-opt-batch-impact__fill--projected"
              style={{ width: `${projection.projectedPercent}%` }}
            />
          </div>
          <span className="profile-opt-batch-impact__value profile-opt-batch-impact__value--projected">
            {projection.projectedPercent}%
          </span>
        </div>
      </div>

      {projection.gainPoints > 0 && (
        <p className="profile-opt-batch-impact__caption">
          Apply Suggestions for <strong>+{projection.gainPoints}%</strong>{" "}
          strength
        </p>
      )}
    </>
  );

  return (
    <section
      className={[
        "profile-opt-batch-impact",
        stackCard && "profile-opt-batch-impact--stack-card",
        stackCard && showSections && "profile-opt-batch-impact--vertical",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={
        hideSessionLabel ? undefined : "profile-opt-batch-impact-title"
      }
    >
      {stackMeta}
      {impactMeters}
      {stackCard && showSections && (
        <div className="profile-opt-batch-impact__sections">
          <p className="profile-opt-batch-impact__sections-heading">
            Section-by-section
          </p>
          <div className="profile-opt-batch-impact__sections-body profile-opt-batch-impact__sections-body--inline">
            <SectionScoresPanel
              scores={sectionScores!}
              activeSectionKeys={activeSectionKeys}
              activeSectionCount={activeSectionCount}
              variant="embedded"
            />
          </div>
        </div>
      )}
    </section>
  );
};
