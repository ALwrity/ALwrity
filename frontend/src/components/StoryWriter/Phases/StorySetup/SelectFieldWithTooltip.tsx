import React from 'react';
import { TextField, MenuItem, Tooltip, IconButton, InputAdornment, Box, Typography } from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { selectMenuProps } from './styles';

interface TooltipContent {
  title: string;
  description: string;
  examples?: Array<{ label: string; description: string }>;
}

interface SelectFieldWithTooltipProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  helperText?: string;
  options: string[];
  customValues?: string[];
  tooltip: TooltipContent;
  sx?: any;
}

export const SelectFieldWithTooltip: React.FC<SelectFieldWithTooltipProps> = ({
  label,
  value,
  onChange,
  helperText,
  options,
  customValues = [],
  tooltip,
  sx,
}) => {
  const allOptions = [...options, ...customValues];
  const isCustom = (option: string) => customValues.includes(option);

  return (
    <TextField
      fullWidth
      select
      label={label}
      value={value}
      onChange={onChange}
      helperText={helperText}
      sx={sx}
      SelectProps={selectMenuProps}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {tooltip.title}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {tooltip.description}
                  </Typography>
                  {tooltip.examples && tooltip.examples.length > 0 && (
                    <>
                      <Typography variant="body2" component="div">
                        {tooltip.examples.map((example, index) => (
                          <React.Fragment key={index}>
                            • <strong>{example.label}</strong>: {example.description}
                            {index < tooltip.examples!.length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </Typography>
                    </>
                  )}
                </Box>
              }
              arrow
              placement="top"
            >
              <IconButton size="small" edge="end">
                <InfoOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    >
      {allOptions.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
          {isCustom(option) && (
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 1, color: '#5D4037', fontStyle: 'italic', fontWeight: 600 }}
            >
              (AI Generated)
            </Typography>
          )}
        </MenuItem>
      ))}
    </TextField>
  );
};

