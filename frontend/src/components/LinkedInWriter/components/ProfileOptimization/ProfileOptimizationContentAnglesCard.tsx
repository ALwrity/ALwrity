import React from "react";

interface ProfileOptimizationContentAnglesCardProps {
  industry: string;
  expertise?: string;
  opportunities: string[];
  showAllAngles: boolean;
  onToggleShowAllAngles: () => void;
  visibleCount?: number;
  /** Modal: show every angle, hide collapse toggle. */
  alwaysExpanded?: boolean;
}

export const ProfileOptimizationContentAnglesCard: React.FC<
  ProfileOptimizationContentAnglesCardProps
> = ({
  industry,
  expertise,
  opportunities,
  showAllAngles,
  onToggleShowAllAngles,
  visibleCount = 3,
  alwaysExpanded = false,
}) => {
  if (opportunities.length === 0) return null;

  const expanded = alwaysExpanded || showAllAngles;
  const visibleOpportunities = alwaysExpanded
    ? opportunities
    : expanded
      ? opportunities
      : opportunities.slice(0, visibleCount);
  const hiddenCount = alwaysExpanded
    ? 0
    : expanded
      ? 0
      : Math.max(0, opportunities.length - visibleCount);

  return (
    <section
      className={[
        "profile-opt-content-angles",
        alwaysExpanded && "profile-opt-content-angles--expanded",
        alwaysExpanded && "profile-opt-content-angles--modal",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby="profile-opt-content-angles-title"
    >
      <div className="profile-opt-content-angles__head">
        <div className="profile-opt-content-angles__title-row">
          <span className="profile-opt-content-angles__icon" aria-hidden>
            ✎
          </span>
          <h4
            id="profile-opt-content-angles-title"
            className="profile-opt-content-angles__title"
          >
            Content Angles from Your Profile
          </h4>
        </div>
        <p className="profile-opt-content-angles__subtitle">
          Your experience in <strong>{industry}</strong>
          {expertise && (
            <>
              {" "}
              and expertise in <strong>{expertise}</strong>
            </>
          )}{" "}
          makes these content angles native to you — not generic topics.
        </p>
      </div>

      <ul
        className="profile-opt-content-angles__list"
        aria-label={`${visibleOpportunities.length} content angles`}
      >
        {visibleOpportunities.map((opportunity, idx) => (
          <li
            key={`${idx}-${opportunity}`}
            className="profile-opt-content-angles__item"
          >
            <span className="profile-opt-content-angles__index" aria-hidden>
              {idx + 1}
            </span>
            <span className="profile-opt-content-angles__text">
              {opportunity}
            </span>
          </li>
        ))}
      </ul>

      {!alwaysExpanded && hiddenCount > 0 && (
        <button
          type="button"
          className="profile-opt-content-angles__toggle"
          onClick={onToggleShowAllAngles}
          aria-expanded={expanded}
        >
          {expanded
            ? "Show fewer angles ▲"
            : `Show ${hiddenCount} more angle${hiddenCount !== 1 ? "s" : ""} ▼`}
        </button>
      )}

      <button
        type="button"
        className="profile-opt-content-angles__cta"
        onClick={() => {
          window.dispatchEvent(new CustomEvent("linkedinwriter:getTopicIdeas"));
        }}
      >
        + Get topic ideas from these angles
      </button>
    </section>
  );
};
