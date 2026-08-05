/**
 * MUI Select menu props for ImageGenerationModal.
 * Menus must sit above the dialog Modal root (not only the Paper) to stay visible.
 */

import type { MenuProps } from '@mui/material';
import type { PopperProps } from '@mui/material/Popper';
import { buildImageGenerationSelectMenuProps, resolveImageModalPalette } from './imageGenerationModalPalette';
import { DEFAULT_THEME } from './ImageGenerationModal.types';

export {
  IMAGE_GENERATION_DIALOG_Z_INDEX,
  IMAGE_GENERATION_SELECT_MENU_Z_INDEX,
} from './imageGenerationModalZIndex';

/** MenuProps plus Popper overrides (supported at runtime via Menu → Popover). */
export type ImageGenerationSelectMenuProps = Partial<MenuProps> & {
  PopperProps?: Partial<PopperProps>;
};

/**
 * Shared MenuProps for Select fields inside ImageGenerationModal (dark default).
 * zIndex is set on the Menu/Popover root — Paper-only zIndex is not enough inside Dialog.
 */
export const imageGenerationSelectMenuProps: ImageGenerationSelectMenuProps =
  buildImageGenerationSelectMenuProps(resolveImageModalPalette(DEFAULT_THEME));
