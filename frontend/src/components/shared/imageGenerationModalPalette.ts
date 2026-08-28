/**
 * Color palette resolver for ImageGenerationModal (dark default, light for LinkedIn Studio).
 */

import { alpha } from '@mui/material';
import type { ImageModalTheme } from './ImageGenerationModal.types';
import type { ImageGenerationSelectMenuProps } from './imageGenerationSelectMenuProps';

export type ImageModalColorScheme = 'dark' | 'light';

export interface ImageModalPalette {
  colorScheme: ImageModalColorScheme;
  primaryAccent: string;
  secondaryAccent: string;
  warningAccent: string;
  dialogBackground: string;
  dialogBorder: string;
  backdropFilter?: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textHint: string;
  iconMuted: string;
  divider: string;
  inputBg: string;
  inputBorder: string;
  inputBorderHover: string;
  presetBg: string;
  presetBorder: string;
  presetHoverShadow: string;
  cancelColor: string;
  generateDisabledBg: string;
  generateDisabledColor: string;
  infoTitle: string;
  infoBody: string;
  menuPaperBg: string;
  menuPaperBorder: string;
  menuPaperShadow: string;
  menuItemHoverBg: string;
  menuItemSelectedBg: string;
  menuItemSelectedHoverBg: string;
}

const LIGHT_PALETTE_BASE: Omit<
  ImageModalPalette,
  'primaryAccent' | 'secondaryAccent' | 'warningAccent' | 'dialogBackground'
> = {
  colorScheme: 'light',
  dialogBorder: '#e2e8f0',
  backdropFilter: undefined,
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  textHint: '#94a3b8',
  iconMuted: '#94a3b8',
  divider: '#e2e8f0',
  inputBg: '#f8fafc',
  inputBorder: '#cbd5e1',
  inputBorderHover: '#94a3b8',
  presetBg: '#f8fafc',
  presetBorder: '#e2e8f0',
  presetHoverShadow: '0 8px 24px rgba(10, 102, 194, 0.12)',
  cancelColor: '#64748b',
  generateDisabledBg: '#e2e8f0',
  generateDisabledColor: '#94a3b8',
  infoTitle: '#1e293b',
  infoBody: '#475569',
  menuPaperBg: '#ffffff',
  menuPaperBorder: '#e2e8f0',
  menuPaperShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
  menuItemHoverBg: '#f0f7ff',
  menuItemSelectedBg: '#e8f4fd',
  menuItemSelectedHoverBg: '#dbeafe',
};

const DARK_PALETTE_BASE: Omit<
  ImageModalPalette,
  'primaryAccent' | 'secondaryAccent' | 'warningAccent' | 'dialogBackground'
> = {
  colorScheme: 'dark',
  dialogBorder: 'rgba(255,255,255,0.1)',
  backdropFilter: 'blur(20px)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.5)',
  textHint: 'rgba(255,255,255,0.5)',
  iconMuted: 'rgba(255,255,255,0.5)',
  divider: 'rgba(255,255,255,0.1)',
  inputBg: alpha('#ffffff', 0.05),
  inputBorder: 'rgba(255,255,255,0.2)',
  inputBorderHover: 'rgba(255,255,255,0.3)',
  presetBg: alpha('#ffffff', 0.04),
  presetBorder: 'rgba(255,255,255,0.1)',
  presetHoverShadow: '0 8px 24px rgba(0,0,0,0.25)',
  cancelColor: 'rgba(255,255,255,0.7)',
  generateDisabledBg: 'rgba(255,255,255,0.1)',
  generateDisabledColor: 'rgba(255,255,255,0.3)',
  infoTitle: 'rgba(255,255,255,0.9)',
  infoBody: 'rgba(255,255,255,0.7)',
  menuPaperBg: '#1e293b',
  menuPaperBorder: 'rgba(255, 255, 255, 0.15)',
  menuPaperShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
  menuItemHoverBg: 'rgba(255, 255, 255, 0.08)',
  menuItemSelectedBg: 'rgba(255, 255, 255, 0.12)',
  menuItemSelectedHoverBg: 'rgba(255, 255, 255, 0.16)',
};

/** Resolve text/surface tokens from theme (defaults to dark for existing consumers). */
export function resolveImageModalPalette(theme: ImageModalTheme): ImageModalPalette {
  const colorScheme: ImageModalColorScheme =
    theme.colorScheme === 'light' ? 'light' : 'dark';
  const base = colorScheme === 'light' ? LIGHT_PALETTE_BASE : DARK_PALETTE_BASE;

  return {
    ...base,
    dialogBackground: theme.dialogBackground,
    primaryAccent: theme.primaryAccent,
    secondaryAccent: theme.secondaryAccent,
    warningAccent: theme.warningAccent,
  };
}

/** Build Select menu props for the modal color scheme (MUI stacking, no local z-index). */
export function buildImageGenerationSelectMenuProps(
  palette: ImageModalPalette,
): ImageGenerationSelectMenuProps {
  return {
    disablePortal: false,
    disableScrollLock: true,
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    transformOrigin: { vertical: 'top', horizontal: 'left' },
    PaperProps: {
      sx: {
        bgcolor: palette.menuPaperBg,
        backgroundImage: 'none',
        border: `1px solid ${palette.menuPaperBorder}`,
        maxHeight: 360,
        mt: 0.5,
        boxShadow: palette.menuPaperShadow,
      },
    },
    MenuListProps: {
      sx: {
        py: 0.5,
        '& .MuiMenuItem-root': {
          alignItems: 'flex-start',
          py: 1.25,
          whiteSpace: 'normal',
          '&:hover': { bgcolor: palette.menuItemHoverBg },
          '&.Mui-selected': {
            bgcolor: palette.menuItemSelectedBg,
            '&:hover': { bgcolor: palette.menuItemSelectedHoverBg },
          },
        },
      },
    },
    PopperProps: {
      placement: 'bottom-start',
      modifiers: [
        { name: 'flip', enabled: false },
        {
          name: 'preventOverflow',
          enabled: true,
          options: { altAxis: true, tether: true, rootBoundary: 'viewport' },
        },
      ],
    },
  };
}
