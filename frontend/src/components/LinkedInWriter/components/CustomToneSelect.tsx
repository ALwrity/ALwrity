import React from "react";
import {
  LINKEDIN_CUSTOM_TONE_OPTION,
  isCustomToneSelection,
} from "../utils/storageUtils";

export interface CustomToneSelectProps {
  tone?: string;
  customTone?: string;
  presets: readonly string[];
  onChange: (updates: { tone: string; custom_tone?: string }) => void;
  /** Dropdown value for the custom option (default: "Custom") */
  customOptionValue?: string;
  label?: React.ReactNode;
  labelStyle?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  formatOption?: (value: string) => string;
  inputPlaceholder?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
  showLabel?: boolean;
}

export const CustomToneSelect: React.FC<CustomToneSelectProps> = ({
  tone,
  customTone = "",
  presets,
  onChange,
  customOptionValue = LINKEDIN_CUSTOM_TONE_OPTION,
  label = "Tone",
  labelStyle,
  selectStyle,
  inputStyle,
  formatOption = (value) => value,
  inputPlaceholder = "Enter custom tone (e.g., Energetic & direct)",
  id,
  className,
  inputClassName,
  showLabel = true,
}) => {
  const normalizedTone = tone ?? "";
  const isCustom = isCustomToneSelection(normalizedTone);
  const presetValues = presets as readonly string[];
  const matchingPreset = presetValues.find(
    (preset) =>
      preset.toLowerCase() === normalizedTone.trim().toLowerCase(),
  );
  const dropdownValue = isCustom
    ? customOptionValue
    : matchingPreset || normalizedTone || presets[0] || customOptionValue;

  const handleSelect = (value: string) => {
    if (isCustomToneSelection(value)) {
      onChange({ tone: customOptionValue, custom_tone: customTone });
      return;
    }
    const selectedPreset = presetValues.find(
      (preset) => preset.toLowerCase() === value.toLowerCase(),
    );
    onChange({ tone: selectedPreset ?? value, custom_tone: "" });
  };

  return (
    <div className={className}>
      {showLabel && label && (
        <label htmlFor={id} style={labelStyle}>
          {label}
        </label>
      )}
      <select
        id={id}
        value={dropdownValue}
        onChange={(e) => handleSelect(e.target.value)}
        style={selectStyle}
      >
        {presets.map((preset) => (
          <option key={preset} value={preset}>
            {formatOption(preset)}
          </option>
        ))}
        <option value={customOptionValue}>{customOptionValue}</option>
      </select>
      {isCustom && (
        <input
          className={inputClassName}
          value={customTone}
          onChange={(e) =>
            onChange({ tone: customOptionValue, custom_tone: e.target.value })
          }
          placeholder={inputPlaceholder}
          style={inputStyle}
        />
      )}
    </div>
  );
};
