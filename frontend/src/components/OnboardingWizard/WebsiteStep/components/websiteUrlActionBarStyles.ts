import type { SxProps, Theme } from '@mui/material';
import {
  ANALYZE_BUTTON_GRADIENT,
  ANALYZE_BUTTON_HOVER_GRADIENT,
  RE_ANALYZE_BUTTON_GRADIENT,
  RE_ANALYZE_BUTTON_HOVER_GRADIENT,
} from '../../common/onboardingButtonStyles';

export const analyzeButtonSx: SxProps<Theme> = {
  borderRadius: '10px',
  textTransform: 'none',
  px: 2.5,
  py: 0,
  minHeight: '100%',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#FFFFFF',
  background: ANALYZE_BUTTON_GRADIENT,
  boxShadow: '0 2px 10px rgba(99, 102, 241, 0.28)',
  '&:hover': {
    background: ANALYZE_BUTTON_HOVER_GRADIENT,
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
  },
  '&.Mui-disabled': {
    background:
      'linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(99, 102, 241, 0.35) 50%, rgba(59, 130, 246, 0.35) 100%)',
    color: 'rgba(255,255,255,0.65)',
    boxShadow: 'none',
  },
};

export const reAnalyzeButtonSx: SxProps<Theme> = {
  borderRadius: '10px',
  textTransform: 'none',
  px: 2.5,
  py: 0,
  minHeight: '100%',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#FFFFFF',
  background: RE_ANALYZE_BUTTON_GRADIENT,
  boxShadow: '0 2px 10px rgba(59, 130, 246, 0.28)',
  '&:hover': {
    background: RE_ANALYZE_BUTTON_HOVER_GRADIENT,
    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
  },
  '&.Mui-disabled': {
    background:
      'linear-gradient(135deg, rgba(59, 130, 246, 0.35) 0%, rgba(99, 102, 241, 0.35) 50%, rgba(124, 58, 237, 0.35) 100%)',
    color: 'rgba(255,255,255,0.65)',
    boxShadow: 'none',
  },
};

export const analyzeNewWebsiteButtonSx: SxProps<Theme> = {
  whiteSpace: 'nowrap',
  textTransform: 'none',
  fontSize: '0.8rem',
  fontWeight: 600,
  px: 1.5,
  minHeight: '100%',
  color: '#6366F1',
  borderRadius: '10px',
  border: '1px solid #C7D2FE',
  bgcolor: '#FFFFFF',
  boxShadow: 'none',
  '&:hover': {
    color: '#4F46E5',
    bgcolor: '#EEF2FF',
    borderColor: '#A5B4FC',
    boxShadow: 'none',
  },
};

/** Compact hover-popover URL field — smaller controls with buttons inside the input. */
export const hoverCompactUrlFieldSx = (hasSecondaryAction: boolean): SxProps<Theme> => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    bgcolor: '#F8FAFC',
    minHeight: 38,
    pr: hasSecondaryAction ? { xs: '188px', sm: '196px' } : '92px',
    '& fieldset': { borderColor: '#CBD5E1' },
    '&:hover fieldset': { borderColor: '#8B5CF6' },
    '&.Mui-focused fieldset': { borderColor: '#6366F1', borderWidth: 2 },
  },
  '& .MuiInputLabel-root': {
    color: '#64748B',
    fontWeight: 500,
    fontSize: '0.72rem',
    '&.Mui-focused': { color: '#6366F1' },
  },
  '& .MuiInputBase-input': {
    color: '#1E293B',
    fontSize: '0.72rem',
    py: 0.65,
    fontWeight: 600,
  },
});

export const hoverCompactReAnalyzeButtonSx: SxProps<Theme> = {
  ...reAnalyzeButtonSx,
  borderRadius: '8px',
  px: 1,
  minHeight: 26,
  fontSize: '0.65rem',
  boxShadow: 'none',
  '& .MuiButton-startIcon': { mr: 0.35, marginLeft: 0 },
  '&:hover': { boxShadow: 'none' },
};

export const hoverCompactAnalyzeNewWebsiteButtonSx: SxProps<Theme> = {
  ...analyzeNewWebsiteButtonSx,
  borderRadius: '8px',
  px: 0.85,
  minHeight: 26,
  fontSize: '0.62rem',
  lineHeight: 1.1,
};

export const urlFieldSx = (
  hasSecondaryAction: boolean,
  variant: 'default' | 'compact' = 'default'
): SxProps<Theme> =>
  variant === 'compact'
    ? hoverCompactUrlFieldSx(hasSecondaryAction)
    : {
        width: '100%',
        '& .MuiOutlinedInput-root': {
          borderRadius: 3,
          bgcolor: '#F8FAFC',
          pr: hasSecondaryAction ? '300px' : '148px',
          '& fieldset': { borderColor: '#CBD5E1' },
          '&:hover fieldset': { borderColor: '#8B5CF6' },
          '&.Mui-focused fieldset': { borderColor: '#6366F1', borderWidth: 2 },
        },
        '& .MuiInputLabel-root': {
          color: '#64748B',
          fontWeight: 500,
          '&.Mui-focused': { color: '#6366F1' },
        },
        '& .MuiInputBase-input': {
          color: '#1E293B',
        },
      };

/** @deprecated use hoverCompactAnalyzeNewWebsiteButtonSx in compact hover popover */
export const hoverAnalyzeNewWebsiteButtonSx: SxProps<Theme> = hoverCompactAnalyzeNewWebsiteButtonSx;
