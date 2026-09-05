import type { SxProps, Theme } from '@mui/material';

export const FOLDER_TAB_PARTITION_COLOR = '#E2E8F0';

/** Shared horizontal gradient used on inactive tab baselines and card side/bottom edges. */
export const FOLDER_TAB_CARD_GRADIENT =
  'linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%)';

/**
 * Even pink → purple → blue loop on the active tab's top and side edges.
 * Bottom edge stays flat so the grey partition can sit only under the selected cell.
 */
export const FOLDER_TAB_ACTIVE_BORDER_GRADIENT =
  'conic-gradient(from 225deg at 50% calc(100% - 2px), #EC4899 0deg, #D946EF 72deg, #8B5CF6 144deg, #6366F1 216deg, #3B82F6 288deg, #EC4899 360deg)';

/** Header row shell — no full-width partition; per-tab styling owns the baseline. */
export const folderTabHeaderSx: SxProps<Theme> = {
  position: 'relative',
  bgcolor: '#F8FAFC',
  p: 0,
  mx: '-3px',
  marginTop: '-3px',
  borderBottom: 'none',
};

export const folderTabsContainerSx: SxProps<Theme> = {
  width: '100%',
  '& .MuiTabs-indicator': { display: 'none' },
  '& .MuiTabs-flexContainer': {
    alignItems: 'flex-end',
    width: '100%',
    gap: 0,
  },
  '& .MuiTab-root': {
    minHeight: 72,
  },
};

const inactiveTabBaselineSx: SxProps<Theme> = {
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '3px',
    background: FOLDER_TAB_CARD_GRADIENT,
    pointerEvents: 'none',
  },
};

export function getFolderTabSx(
  isActive: boolean,
  tabIndex = 0,
  totalTabs = 3
): SxProps<Theme> {
  const isFirst = tabIndex === 0;
  const isLast = tabIndex === totalTabs - 1;

  const base: SxProps<Theme> = {
    alignItems: 'center',
    justifyContent: 'center',
    px: 3,
    py: 2,
    minWidth: 'auto',
    textTransform: 'none',
    position: 'relative',
    borderRadius: '24px 24px 0 0',
    transition: 'background-color 0.2s ease',
  };

  if (!isActive) {
    return {
      ...base,
      bgcolor: '#F8FAFC',
      border: 'none',
      zIndex: 1,
      ...inactiveTabBaselineSx,
      '&:hover': { bgcolor: '#F1F5F9' },
    };
  }

  return {
    ...base,
    bgcolor: '#FFFFFF',
    background: `linear-gradient(#fff, #fff) padding-box, ${FOLDER_TAB_ACTIVE_BORDER_GRADIENT} border-box`,
    border: '3px solid transparent',
    borderBottom: `1px solid ${FOLDER_TAB_PARTITION_COLOR}`,
    marginBottom: '-1px',
    zIndex: 2,
    ...(isFirst && { borderTopLeftRadius: '22px' }),
    ...(isLast && { borderTopRightRadius: '22px' }),
    '&:hover': { bgcolor: '#FFFFFF' },
  };
}

export const folderTabCardSx: SxProps<Theme> = {
  border: '3px solid transparent',
  borderTop: 'none',
  background: `linear-gradient(#fff, #fff) padding-box, ${FOLDER_TAB_CARD_GRADIENT} border-box`,
  borderRadius: '0 0 24px 24px',
  overflow: 'visible',
  bgcolor: '#FFFFFF',
  boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
};

export const folderTabDashboardSpacingSx = (dashboardFirstMode: boolean): SxProps<Theme> => ({
  mt: dashboardFirstMode ? 1.5 : 4,
  mb: dashboardFirstMode ? 0 : 3,
});
