/**
 * MUI Select menu props for ImageGenerationModal.
 * Menus portal to body; MUI Modal manager stacks them above the parent Dialog.
 */

import type { MenuProps } from '@mui/material';
import type { PopperProps } from '@mui/material/Popper';
import { buildImageGenerationSelectMenuProps, resolveImageModalPalette } from './imageGenerationModalPalette';
import { DEFAULT_THEME } from './ImageGenerationModal.types';

/** MenuProps plus Popper overrides (supported at runtime via Menu → Popover). */
export type ImageGenerationSelectMenuProps = Partial<MenuProps> & {
  PopperProps?: Partial<PopperProps>;
};

/** Shared MenuProps for Select fields inside ImageGenerationModal (dark default). */
export const imageGenerationSelectMenuProps: ImageGenerationSelectMenuProps =
  buildImageGenerationSelectMenuProps(resolveImageModalPalette(DEFAULT_THEME));
