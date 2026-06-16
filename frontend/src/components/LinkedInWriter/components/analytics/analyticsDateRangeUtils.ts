import type {
  LinkedInAnalyticsPresetDays,
  LinkedInPersonalAnalyticsRequest,
} from '../../../../api/linkedinSocial';

export const PRESET_OPTIONS: Array<{ value: LinkedInAnalyticsPresetDays; label: string }> = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 28, label: '28 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '365 days' },
];

export const DEFAULT_PRESET_DAYS: LinkedInAnalyticsPresetDays = 7;

export type AnalyticsDateRangeSelection =
  | { mode: 'preset'; presetDays: LinkedInAnalyticsPresetDays }
  | { mode: 'custom'; startDate: string; endDate: string };

export function endInclusiveFromApi(endExclusive: string): string {
  const end = new Date(`${endExclusive}T00:00:00`);
  end.setDate(end.getDate() - 1);
  return toIsoDate(end);
}

export function formatPickerTriggerLabel(start: string, endInclusive: string): string {
  const startLabel = formatUsDate(start);
  const endLabel = formatUsDate(endInclusive);
  return `${startLabel} - ${endLabel}`;
}

export function formatUsDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function selectionFromDateRange(
  start: string,
  endExclusive: string
): AnalyticsDateRangeSelection {
  const endInclusive = endInclusiveFromApi(endExclusive);
  const preset = PRESET_OPTIONS.find((option) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${endInclusive}T00:00:00`);
    const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    return spanDays === option.value;
  });

  if (preset) {
    return { mode: 'preset', presetDays: preset.value };
  }

  return { mode: 'custom', startDate: start, endDate: endInclusive };
}

export function selectionToRequest(
  selection: AnalyticsDateRangeSelection
): LinkedInPersonalAnalyticsRequest {
  if (selection.mode === 'preset') {
    return { presetDays: selection.presetDays };
  }
  return { startDate: selection.startDate, endDate: selection.endDate };
}

export function isCustomSelectionValid(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;
  return startDate <= endDate;
}

export function defaultCustomDates(endInclusive?: string): { startDate: string; endDate: string } {
  const end = endInclusive ?? toIsoDate(new Date());
  const endDateObj = new Date(`${end}T00:00:00`);
  const startDateObj = new Date(endDateObj);
  startDateObj.setDate(startDateObj.getDate() - (DEFAULT_PRESET_DAYS - 1));
  return { startDate: toIsoDate(startDateObj), endDate: end };
}
