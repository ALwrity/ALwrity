import React from 'react';
import { PYMK_COHORT_OPTIONS, type PymkCohort, type PymkCohortDefaults } from '../../../../services/linkedInPymkApi';
import { colors, secondaryBtn } from '../GrowthEngine/styles';

interface PymkCohortFilterProps {
  cohort: PymkCohort;
  cohortId: string;
  cohortDefaults: PymkCohortDefaults | null;
  onCohortChange: (cohort: PymkCohort) => void;
  onCohortIdChange: (value: string) => void;
}

export const PymkCohortFilter: React.FC<PymkCohortFilterProps> = ({
  cohort,
  cohortId,
  cohortDefaults,
  onCohortChange,
  onCohortIdChange,
}) => {
  const selected = PYMK_COHORT_OPTIONS.find((option) => option.id === cohort);
  const autoDetected =
    selected?.defaultsKey && cohortDefaults?.[selected.defaultsKey]
      ? String(cohortDefaults[selected.defaultsKey])
      : null;
  const autoIndustryName =
    cohort === 'same_industry' && cohortDefaults?.industry_name
      ? cohortDefaults.industry_name
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PYMK_COHORT_OPTIONS.map((option) => {
          const active = option.id === cohort;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onCohortChange(option.id)}
              style={{
                ...secondaryBtn,
                borderColor: active ? colors.primary : '#d1d5db',
                color: active ? colors.primary : colors.textMuted,
                background: active ? '#eff6ff' : '#fff',
                fontWeight: active ? 600 : 500,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {selected?.needsId && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: colors.textMuted }}>
            {cohort === 'same_school' && 'School ID (auto-detected when available)'}
            {cohort === 'same_job' && 'Super title ID (auto-detected when available)'}
            {cohort === 'same_industry' && 'Industry ID (auto-detected when available)'}
          </span>
          {autoDetected && !cohortId && (
            <span style={{ color: colors.primary, fontSize: 11 }}>
              {cohort === 'same_industry' && autoIndustryName
                ? `Using your industry: ${autoIndustryName} (ID ${autoDetected})`
                : `Using auto-detected ID: ${autoDetected}`}
            </span>
          )}
          <input
            type="text"
            value={cohortId}
            onChange={(event) => onCohortIdChange(event.target.value)}
            placeholder={
              cohort === 'same_school'
                ? 'e.g. 43416'
                : cohort === 'same_job'
                  ? 'e.g. 564'
                  : 'e.g. 4'
            }
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13,
            }}
          />
        </label>
      )}
    </div>
  );
};
