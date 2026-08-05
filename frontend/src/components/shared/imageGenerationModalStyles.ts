/**
 * Theme-aware style tokens for ImageGenerationModal.
 */

import { alpha } from '@mui/material';
import type { ImageModalTheme } from './ImageGenerationModal.types';
import {
  buildImageGenerationSelectMenuProps,
  resolveImageModalPalette,
  type ImageModalPalette,
} from './imageGenerationModalPalette';
import type { ImageGenerationSelectMenuProps } from './imageGenerationSelectMenuProps';

export interface ImageGenerationModalStyles {
  palette: ImageModalPalette;
  selectMenuProps: ImageGenerationSelectMenuProps;
  selectSx: Record<string, unknown>;
  dialogPaperSx: Record<string, unknown>;
  sectionTitleSx: Record<string, unknown>;
  sectionCaptionSx: Record<string, unknown>;
  helpIconSx: Record<string, unknown>;
  closeIconSx: Record<string, unknown>;
  dividerSx: Record<string, unknown>;
  presetPaperSx: Record<string, unknown>;
  presetMetaSx: Record<string, unknown>;
  textFieldSx: Record<string, unknown>;
  promptHintSx: Record<string, unknown>;
  menuItemTitleSx: Record<string, unknown>;
  menuItemCaptionSx: Record<string, unknown>;
  infoTitleSx: Record<string, unknown>;
  infoBodySx: Record<string, unknown>;
  cancelButtonSx: Record<string, unknown>;
  generateButtonSx: (isGenerating: boolean) => Record<string, unknown>;
  infoPanelSx: (accent: string) => Record<string, unknown>;
}

export function createImageGenerationModalStyles(
  theme: ImageModalTheme,
): ImageGenerationModalStyles {
  const palette = resolveImageModalPalette(theme);
  const selectMenuProps = buildImageGenerationSelectMenuProps(palette);

  const selectSx = {
    backgroundColor: palette.inputBg,
    color: palette.textPrimary,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: palette.inputBorder,
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: palette.inputBorderHover,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: palette.primaryAccent,
    },
    '& .MuiSvgIcon-root': {
      color: palette.textSecondary,
    },
  };

  const dialogPaperSx: Record<string, unknown> = {
    background: palette.dialogBackground,
    border: `1px solid ${palette.dialogBorder}`,
    borderRadius: 4,
    overflow: 'visible',
  };
  if (palette.backdropFilter) {
    dialogPaperSx.backdropFilter = palette.backdropFilter;
  }
  if (palette.colorScheme === 'light') {
    dialogPaperSx.boxShadow = '0 16px 48px rgba(15, 23, 42, 0.12)';
  }

  return {
    palette,
    selectMenuProps,
    selectSx,
    dialogPaperSx,
    sectionTitleSx: { color: palette.textPrimary, fontWeight: 600 },
    sectionCaptionSx: { color: palette.textSecondary },
    helpIconSx: { color: palette.iconMuted },
    closeIconSx: { color: palette.textSecondary },
    dividerSx: { borderColor: palette.divider },
    presetPaperSx: {
      p: 1.5,
      flex: 1,
      cursor: 'pointer',
      backgroundColor: palette.presetBg,
      border: `1px solid ${palette.presetBorder}`,
      borderRadius: 2,
      transition: 'all 0.2s ease',
      '&:hover': {
        borderColor: alpha(palette.primaryAccent, 0.7),
        boxShadow: palette.presetHoverShadow,
        backgroundColor: alpha(palette.primaryAccent, 0.08),
      },
    },
    presetMetaSx: { color: palette.textSecondary, fontSize: '0.8rem' },
    textFieldSx: {
      '& .MuiOutlinedInput-root': {
        backgroundColor: palette.inputBg,
        color: palette.textPrimary,
        '& fieldset': {
          borderColor: palette.inputBorder,
        },
        '&:hover fieldset': {
          borderColor: palette.inputBorderHover,
        },
        '&.Mui-focused fieldset': {
          borderColor: palette.primaryAccent,
        },
      },
      '& .MuiInputBase-input': {
        color: palette.textPrimary,
      },
    },
    promptHintSx: { color: palette.textHint, mt: 0.5, display: 'block' },
    menuItemTitleSx: { color: palette.textPrimary },
    menuItemCaptionSx: { color: palette.textSecondary },
    infoTitleSx: { color: palette.infoTitle, fontWeight: 500, mb: 0.5 },
    infoBodySx: { color: palette.infoBody, lineHeight: 1.6 },
    cancelButtonSx: { color: palette.cancelColor },
    generateButtonSx: (isGenerating: boolean) => ({
      backgroundColor: isGenerating
        ? palette.generateDisabledBg
        : palette.primaryAccent,
      color: '#ffffff',
      '&:hover': {
        backgroundColor: isGenerating
          ? palette.generateDisabledBg
          : alpha(palette.primaryAccent, 0.8),
      },
      '&:disabled': {
        backgroundColor: palette.generateDisabledBg,
        color: palette.generateDisabledColor,
      },
      px: 3,
      py: 1,
      borderRadius: 2,
    }),
    infoPanelSx: (accent: string) => ({
      mt: 1.5,
      p: 1.5,
      backgroundColor: alpha(accent, 0.1),
      border: `1px solid ${alpha(accent, 0.3)}`,
      borderRadius: 2,
    }),
  };
}
