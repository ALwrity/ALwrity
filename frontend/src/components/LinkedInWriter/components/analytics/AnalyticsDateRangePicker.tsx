import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  Popover,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { KeyboardArrowDown as KeyboardArrowDownIcon } from '@mui/icons-material';

import type { LinkedInAnalyticsDateRange, LinkedInAnalyticsPresetDays } from '../../../../api/linkedinSocial';
import {
  DEFAULT_PRESET_DAYS,
  PRESET_OPTIONS,
  type AnalyticsDateRangeSelection,
  defaultCustomDates,
  endInclusiveFromApi,
  formatPickerTriggerLabel,
  isCustomSelectionValid,
  selectionFromDateRange,
} from './analyticsDateRangeUtils';

interface AnalyticsDateRangePickerProps {
  dateRange: LinkedInAnalyticsDateRange | null;
  onApply: (selection: AnalyticsDateRangeSelection) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const AnalyticsDateRangePicker: React.FC<AnalyticsDateRangePickerProps> = ({
  dateRange,
  onApply,
  disabled = false,
  isLoading = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const appliedSelection = useMemo(
    () =>
      dateRange
        ? selectionFromDateRange(dateRange.start, dateRange.endExclusive)
        : { mode: 'preset' as const, presetDays: DEFAULT_PRESET_DAYS },
    [dateRange]
  );

  const [draftSelection, setDraftSelection] =
    useState<AnalyticsDateRangeSelection>(appliedSelection);

  useEffect(() => {
    if (!anchorEl) {
      setDraftSelection(appliedSelection);
    }
  }, [appliedSelection, anchorEl]);

  const triggerLabel = useMemo(() => {
    if (!dateRange) return 'Last 7 days';
    const endInclusive = endInclusiveFromApi(dateRange.endExclusive);
    return formatPickerTriggerLabel(dateRange.start, endInclusive);
  }, [dateRange]);

  const customDates =
    draftSelection.mode === 'custom'
      ? { startDate: draftSelection.startDate, endDate: draftSelection.endDate }
      : defaultCustomDates(
          dateRange ? endInclusiveFromApi(dateRange.endExclusive) : undefined
        );

  const canApply =
    draftSelection.mode === 'preset' ||
    isCustomSelectionValid(customDates.startDate, customDates.endDate);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled || isLoading) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleApply = () => {
    if (!canApply) return;
    onApply(draftSelection);
    handleClose();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || isLoading}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchorEl)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid #cbd5e1',
          backgroundColor: '#fff',
          color: '#0f172a',
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled || isLoading ? 'default' : 'pointer',
          opacity: disabled || isLoading ? 0.7 : 1,
        }}
      >
        {triggerLabel}
        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: '#64748b' }} />
      </button>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 2,
              width: 280,
              borderRadius: 3,
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
            },
          },
        }}
      >
        <RadioGroup
          value={draftSelection.mode === 'custom' ? 'custom' : String(draftSelection.presetDays)}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'custom') {
              const dates = defaultCustomDates(
                dateRange ? endInclusiveFromApi(dateRange.endExclusive) : undefined
              );
              setDraftSelection({
                mode: 'custom',
                startDate: dates.startDate,
                endDate: dates.endDate,
              });
              return;
            }
            setDraftSelection({
              mode: 'preset',
              presetDays: Number(value) as LinkedInAnalyticsPresetDays,
            });
          }}
        >
          {PRESET_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.value}
              value={String(option.value)}
              control={<Radio size="small" sx={{ color: '#0A66C2', '&.Mui-checked': { color: '#15803d' } }} />}
              label={option.label}
              sx={{ mx: 0 }}
            />
          ))}
          <FormControlLabel
            value="custom"
            control={<Radio size="small" sx={{ color: '#0A66C2', '&.Mui-checked': { color: '#15803d' } }} />}
            label="Custom"
            sx={{ mx: 0 }}
          />
        </RadioGroup>

        {draftSelection.mode === 'custom' && (
          <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5 }}>
            <TextField
              label="Start date"
              type="date"
              size="small"
              fullWidth
              value={customDates.startDate}
              onChange={(event) =>
                setDraftSelection({
                  mode: 'custom',
                  startDate: event.target.value,
                  endDate: customDates.endDate,
                })
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End date"
              type="date"
              size="small"
              fullWidth
              value={customDates.endDate}
              onChange={(event) =>
                setDraftSelection({
                  mode: 'custom',
                  startDate: customDates.startDate,
                  endDate: event.target.value,
                })
              }
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        )}

        <Button
          fullWidth
          variant="contained"
          onClick={handleApply}
          disabled={!canApply || isLoading}
          sx={{
            mt: 2,
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 700,
            backgroundColor: '#0A66C2',
            '&:hover': { backgroundColor: '#004182' },
          }}
        >
          Show results
        </Button>

        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1.5, color: '#64748b', textAlign: 'center' }}
        >
          Data may lag ~48h
        </Typography>
      </Popover>
    </>
  );
};
