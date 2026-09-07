import type { SxProps, Theme } from '@mui/material';

/** Neutralize browser autofill blue/yellow blocks inside onboarding URL fields. */
export const URL_INPUT_AUTOFILL_OVERRIDES: SxProps<Theme> = {
  '& .MuiInputBase-input:-webkit-autofill': {
    WebkitBoxShadow: '0 0 0 1000px #F8FAFC inset',
    WebkitTextFillColor: '#1E293B',
    caretColor: '#1E293B',
    transition: 'background-color 9999s ease-out 0s',
  },
  '& .MuiInputBase-input:-webkit-autofill:hover': {
    WebkitBoxShadow: '0 0 0 1000px #F8FAFC inset',
  },
  '& .MuiInputBase-input:-webkit-autofill:focus': {
    WebkitBoxShadow: '0 0 0 1000px #FFFFFF inset',
    WebkitTextFillColor: '#1E293B',
  },
};
