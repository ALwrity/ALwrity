import React from "react";
import { PersonaChip } from "../../TextEditor/ContentPreviewHeaderComponents";
import {
  LinkedInPreferences,
  LINKEDIN_CUSTOM_TONE_OPTION,
  LINKEDIN_PRESET_TONES,
  getToneDropdownValue,
  isCustomToneSelection,
  resolvePersonaTone,
} from "../utils/storageUtils";
import { OptimiseProfileControl } from "./dashboard/OptimiseProfileControl";
import "./persona/content-persona-preferences.css";
import { LinkedInIndustryAutocomplete } from "./LinkedInIndustryAutocomplete";
import type { LinkedInIndustryItem } from "../utils/filterLinkedInIndustries";

/** Phase 1 sample catalog — replaced in Phase 3 with cached API list. */
const PHASE1_SAMPLE_INDUSTRY_ITEMS: LinkedInIndustryItem[] = [
  { id: "sample-1", title: "Retail Art Supplies" },
  { id: "sample-2", title: "Artists and Writers" },
  { id: "sample-3", title: "Performing Arts" },
  { id: "sample-4", title: "Retail Art Dealers" },
  { id: "sample-5", title: "Artificial Intelligence" },
  { id: "sample-6", title: "Performing Arts and Spectator Sports" },
  { id: "sample-7", title: "Fine Arts Schools" },
  { id: "sample-8", title: "Technology" },
  { id: "sample-9", title: "Healthcare" },
  {
    id: "sample-10",
    title: "Artificial Rubber and Synthetic Fiber Manufacturing",
  },
];

interface ContentPersonaPreferencesBodyProps {
  userPreferences: LinkedInPreferences;
  chatHistory: unknown[];
  connected: boolean;
  profileStrengthPercent: number | null;
  strengthLabel: string;
  strengthTooltip: string;
  profileStrengthLoading: boolean;
  onOptimiseProfile: () => void;
  onPreferenceChange: (key: keyof LinkedInPreferences, value: unknown) => void;
  onPreferencesChange: (prefs: Partial<LinkedInPreferences>) => void;
  onPersonaUpdate: (personaData: unknown) => void;
  /** Hide profile strength row on mobile — Optimise lives in header tabs. */
  showProfileStrength?: boolean;
}

export const ContentPersonaPreferencesBody: React.FC<
  ContentPersonaPreferencesBodyProps
> = ({
  userPreferences,
  chatHistory,
  connected,
  profileStrengthPercent,
  strengthLabel,
  strengthTooltip,
  profileStrengthLoading,
  onOptimiseProfile,
  onPreferenceChange,
  onPreferencesChange,
  onPersonaUpdate,
  showProfileStrength = true,
}) => {
  const personaTone = resolvePersonaTone(userPreferences);
  const toneDropdownValue = getToneDropdownValue(userPreferences);
  const showCustomToneInput = isCustomToneSelection(toneDropdownValue);

  const handleToneSelect = (value: string) => {
    if (value === LINKEDIN_CUSTOM_TONE_OPTION) {
      onPreferencesChange({
        tone: LINKEDIN_CUSTOM_TONE_OPTION,
        custom_tone: userPreferences.custom_tone || "",
      });
      return;
    }
    onPreferencesChange({ tone: value, custom_tone: "" });
  };

  return (
    <>
      {connected && showProfileStrength && (
        <div className="linkedin-writer-header-persona-strength">
          <OptimiseProfileControl
            onOptimiseProfile={onOptimiseProfile}
            profileStrengthPercent={profileStrengthPercent}
            strengthLabel={strengthLabel}
            strengthTooltip={strengthTooltip}
            isLoading={profileStrengthLoading}
            isDisabled={false}
            variant="ticker"
          />
        </div>
      )}

      <div className="content-persona-summary">
        <strong>Current Settings:</strong> {personaTone} tone •{" "}
        {userPreferences.industry || "Not set"} industry • {chatHistory.length}{" "}
        messages
      </div>

      <div className="content-persona-prefs-grid">
        <div className={showCustomToneInput ? "content-persona-prefs-grid--wide" : undefined}>
          <div className="content-persona-field-label">Tone</div>
          <select
            className="content-persona-field-input"
            value={toneDropdownValue}
            onChange={(e) => handleToneSelect(e.target.value)}
          >
            {LINKEDIN_PRESET_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
            <option value={LINKEDIN_CUSTOM_TONE_OPTION}>
              {LINKEDIN_CUSTOM_TONE_OPTION}
            </option>
          </select>
          {showCustomToneInput && (
            <input
              className="content-persona-field-input content-persona-field-input--custom-tone"
              value={userPreferences.custom_tone || ""}
              onChange={(e) =>
                onPreferencesChange({
                  tone: LINKEDIN_CUSTOM_TONE_OPTION,
                  custom_tone: e.target.value,
                })
              }
              placeholder="Describe your desired tone (e.g., Bold and witty)"
            />
          )}
        </div>

        <div>
          <div className="content-persona-field-label">Industry</div>
          <LinkedInIndustryAutocomplete
            value={userPreferences.industry}
            onChange={(next) => onPreferenceChange("industry", next)}
            items={PHASE1_SAMPLE_INDUSTRY_ITEMS}
            placeholder="e.g., Technology"
          />
        </div>

        <div>
          <div className="content-persona-field-label">Target Audience</div>
          <input
            className="content-persona-field-input"
            value={userPreferences.target_audience}
            onChange={(e) =>
              onPreferenceChange("target_audience", e.target.value)
            }
            placeholder="e.g., Product Managers"
          />
        </div>

        <div>
          <div className="content-persona-field-label">Writing Style</div>
          <select
            className="content-persona-field-input"
            value={userPreferences.writing_style}
            onChange={(e) =>
              onPreferenceChange("writing_style", e.target.value)
            }
          >
            <option>Clear and Concise</option>
            <option>Storytelling</option>
            <option>Analytical</option>
            <option>Persuasive</option>
          </select>
        </div>
      </div>

      <div className="content-persona-checkboxes">
        <label className="content-persona-checkbox-label">
          <input
            type="checkbox"
            checked={userPreferences.hashtag_preferences}
            onChange={(e) =>
              onPreferenceChange("hashtag_preferences", e.target.checked)
            }
          />
          Include Hashtags
        </label>
        <label className="content-persona-checkbox-label">
          <input
            type="checkbox"
            checked={userPreferences.cta_preferences}
            onChange={(e) =>
              onPreferenceChange("cta_preferences", e.target.checked)
            }
          />
          Include Call-to-Action
        </label>
      </div>

      <div className="content-persona-context">
        <div className="content-persona-context__title">Current Context:</div>
        <div className="content-persona-context__chips">
          {personaTone && (
            <span className="content-persona-context__chip content-persona-context__chip--tone">
              {personaTone}
            </span>
          )}
          {userPreferences.industry && (
            <span className="content-persona-context__chip content-persona-context__chip--industry">
              {userPreferences.industry}
            </span>
          )}
          {userPreferences.target_audience && (
            <span className="content-persona-context__chip content-persona-context__chip--audience">
              {userPreferences.target_audience}
            </span>
          )}
          <span className="content-persona-context__chip content-persona-context__chip--messages">
            {chatHistory.length} messages
          </span>
        </div>
      </div>

      <div className="content-persona-writing-box">
        <div className="content-persona-writing-box__header">
          <h5 className="content-persona-writing-box__title">Writing Persona</h5>
          <p className="content-persona-writing-box__desc">
            Persona is applied when available. Click the persona chip below to
            edit your writing style.
          </p>
        </div>
        <div className="content-persona-writing-box__chip-row">
          <PersonaChip platform="linkedin" onPersonaUpdate={onPersonaUpdate} />
        </div>
        <div className="content-persona-writing-box__hint">
          Click persona to edit writing style, tone, and preferences
        </div>
      </div>
    </>
  );
};
