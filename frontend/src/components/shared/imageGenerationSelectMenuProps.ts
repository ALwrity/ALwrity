/**
 * MUI Select menu props for ImageGenerationModal.
 * Menus must sit above the dialog Modal root (not only the Paper) to stay visible.
 */

import type { MenuProps } from '@mui/material';
import type { PopperProps } from '@mui/material/Popper';

/** Above MUI Popover/Dialog default (1300). */
export const IMAGE_GENERATION_DIALOG_Z_INDEX = 1400;

/** Above the image generation dialog backdrop and paper. */
export const IMAGE_GENERATION_SELECT_MENU_Z_INDEX = 1500;

const menuPaperSx = {
  bgcolor: '#1e293b',
  backgroundImage: 'none',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  maxHeight: 360,
  mt: 0.5,
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
};

const menuListSx = {
  py: 0.5,
  '& .MuiMenuItem-root': {
    alignItems: 'flex-start',
    py: 1.25,
    whiteSpace: 'normal',
    '&:hover': {
      bgcolor: 'rgba(255, 255, 255, 0.08)',
    },
    '&.Mui-selected': {
      bgcolor: 'rgba(255, 255, 255, 0.12)',
      '&:hover': {
        bgcolor: 'rgba(255, 255, 255, 0.16)',
      },
    },
  },
};

/** MenuProps plus Popper overrides (supported at runtime via Menu → Popover). */
export type ImageGenerationSelectMenuProps = Partial<MenuProps> & {
  PopperProps?: Partial<PopperProps>;
};

/**
 * Shared MenuProps for Select fields inside ImageGenerationModal.
 * zIndex is set on the Menu/Popover root — Paper-only zIndex is not enough inside Dialog.
 */
export const imageGenerationSelectMenuProps: ImageGenerationSelectMenuProps = {
  disablePortal: false,
  disableScrollLock: true,
  anchorOrigin: {
    vertical: 'bottom',
    horizontal: 'left',
  },
  transformOrigin: {
    vertical: 'top',
    horizontal: 'left',
  },
  sx: {
    zIndex: IMAGE_GENERATION_SELECT_MENU_Z_INDEX,
  },
  PaperProps: {
    sx: menuPaperSx,
  },
  MenuListProps: {
    sx: menuListSx,
  },
  PopperProps: {
    placement: 'bottom-start',
    modifiers: [
      {
        name: 'flip',
        enabled: false,
      },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          altAxis: true,
          tether: true,
          rootBoundary: 'viewport',
        },
      },
    ],
    sx: {
      zIndex: IMAGE_GENERATION_SELECT_MENU_Z_INDEX,
    },
  },
};
