import React from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';

interface UsagePeriodSelectorProps {
  selectedPeriod: string;
  availablePeriods: string[];
  onChange: (event: SelectChangeEvent) => void;
  /** Compact styling for UserBadge menu header row. */
  menuHeader?: boolean;
}

/** Billing period picker (month/year) for usage dashboards. */
export const UsagePeriodSelector: React.FC<UsagePeriodSelectorProps> = ({
  selectedPeriod,
  availablePeriods,
  onChange,
  menuHeader = false,
}) => {
  if (availablePeriods.length > 1) {
    return (
      <FormControl
        variant="standard"
        size="small"
        sx={{
          minWidth: menuHeader ? 'auto' : 100,
          mr: 0,
          overflow: 'visible',
        }}
      >
        <Select
          value={selectedPeriod}
          onChange={onChange}
          disableUnderline
          renderValue={
            menuHeader
              ? (value) => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, pr: 0.25 }}>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: '#374151',
                        lineHeight: 1,
                      }}
                    >
                      {value}
                    </Typography>
                    <CalendarMonth sx={{ fontSize: 14, color: '#6b7280', flexShrink: 0 }} />
                  </Box>
                )
              : undefined
          }
          sx={{
            fontSize: menuHeader ? '0.75rem' : '0.875rem',
            fontWeight: 500,
            color: '#374151',
            overflow: 'visible',
            '& .MuiSelect-select': {
              py: menuHeader ? 0.25 : 0.5,
              pl: 0,
              pr: menuHeader ? '0 !important' : '24px !important',
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiSelect-icon': {
              display: menuHeader ? 'none' : 'block',
            },
          }}
          IconComponent={
            menuHeader
              ? () => null
              : (props) => (
                  <CalendarMonth
                    {...props}
                    sx={{
                      fontSize: 16,
                      color: '#6b7280',
                      pointerEvents: 'none',
                    }}
                  />
                )
          }
        >
          {availablePeriods.map((period) => (
            <MenuItem key={period} value={period} dense>
              {period}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (!selectedPeriod) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: menuHeader ? 0.25 : 0.35, flexShrink: 0 }}>
      <Typography sx={{ fontSize: menuHeader ? '0.75rem' : '0.875rem', fontWeight: 500, color: '#374151', lineHeight: 1 }}>
        {selectedPeriod}
      </Typography>
      <CalendarMonth sx={{ fontSize: menuHeader ? 14 : 16, color: '#6b7280', flexShrink: 0 }} />
    </Box>
  );
};
