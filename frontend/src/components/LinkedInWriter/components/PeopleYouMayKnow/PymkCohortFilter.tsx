import React from "react";
import {
  PYMK_COHORT_OPTIONS,
  type PymkCohort,
  type PymkCohortDefaults,
} from "../../../../services/linkedInPymkApi";
import { colors } from "../GrowthEngine/styles";

export interface PymkCohortIdFieldProps {
  cohort: PymkCohort;
  cohortId: string;
  cohortDefaults: PymkCohortDefaults | null;
  onCohortIdChange: (value: string) => void;
}

/** Optional cohort ID override (school / job / industry). */
export const PymkCohortIdField: React.FC<PymkCohortIdFieldProps> = ({
  cohort,
  cohortId,
  cohortDefaults,
  onCohortIdChange,
}) => {
  const selected = PYMK_COHORT_OPTIONS.find((option) => option.id === cohort);
  if (!selected?.needsId) return null;

  const autoDetected =
    selected.defaultsKey && cohortDefaults?.[selected.defaultsKey]
      ? String(cohortDefaults[selected.defaultsKey])
      : null;
  const autoIndustryName =
    cohort === "same_industry" && cohortDefaults?.industry_name
      ? cohortDefaults.industry_name
      : null;

  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 12,
        marginTop: 10,
      }}
    >
      <span style={{ color: colors.textMuted }}>
        {cohort === "same_school" && "School ID (auto-detected when available)"}
        {cohort === "same_job" && "Super title ID (auto-detected when available)"}
        {cohort === "same_industry" &&
          "Industry ID (auto-detected when available)"}
      </span>
      {autoDetected && !cohortId && (
        <span style={{ color: colors.primary, fontSize: 11 }}>
          {cohort === "same_industry" && autoIndustryName
            ? `Using your industry: ${autoIndustryName} (ID ${autoDetected})`
            : `Using auto-detected ID: ${autoDetected}`}
        </span>
      )}
      <input
        type="text"
        value={cohortId}
        onChange={(event) => onCohortIdChange(event.target.value)}
        placeholder={
          cohort === "same_school"
            ? "e.g. 43416"
            : cohort === "same_job"
              ? "e.g. 564"
              : "e.g. 4"
        }
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          fontSize: 13,
        }}
      />
    </label>
  );
};

/** @deprecated Use PymkCohortToolbar + PymkCohortIdField */
export { PymkCohortIdField as PymkCohortFilter };
