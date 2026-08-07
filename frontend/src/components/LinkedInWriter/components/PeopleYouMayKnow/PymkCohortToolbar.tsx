import React from "react";
import {
  PYMK_COHORT_OPTIONS,
  type PymkCohort,
} from "../../../../services/linkedInPymkApi";
import { EngagementRefreshButton } from "../dashboard/engagementWedgeSharedUi";

export interface PymkCohortToolbarProps {
  cohort: PymkCohort;
  loading: boolean;
  onCohortChange: (cohort: PymkCohort) => void;
  onRefresh: () => void;
}

export const PymkCohortToolbar: React.FC<PymkCohortToolbarProps> = ({
  cohort,
  loading,
  onCohortChange,
  onRefresh,
}) => (
  <div className="grow-network-pymk-toolbar" data-testid="pymk-cohort-toolbar">
    {PYMK_COHORT_OPTIONS.map((option) => {
      const active = option.id === cohort;
      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onCohortChange(option.id)}
          disabled={loading}
          className={[
            "grow-network-pymk-chip",
            active ? "grow-network-pymk-chip--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {option.label}
        </button>
      );
    })}
    <EngagementRefreshButton
      onClick={onRefresh}
      disabled={loading}
      loading={loading}
      testId="pymk-refresh-btn"
      className="grow-network-pymk-refresh"
    />
  </div>
);
