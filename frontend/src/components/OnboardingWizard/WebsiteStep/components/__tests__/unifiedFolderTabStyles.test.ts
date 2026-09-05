import { describe, it, expect } from 'vitest';
import {
  FOLDER_TAB_CARD_GRADIENT,
  FOLDER_TAB_PARTITION_COLOR,
  folderTabHeaderSx,
  getFolderTabSx,
} from '../unifiedFolderTabStyles';

describe('unifiedFolderTabStyles', () => {
  it('does not draw a full-width grey partition on the header row', () => {
    expect(folderTabHeaderSx.borderBottom).toBe('none');
    expect(JSON.stringify(folderTabHeaderSx)).not.toContain('border-box');
  });

  it('shows grey partition only on the active tab cell', () => {
    const activeSx = getFolderTabSx(true, 1) as Record<string, unknown>;
    expect(activeSx.borderBottom).toBe(`1px solid ${FOLDER_TAB_PARTITION_COLOR}`);
    expect(String(activeSx.background)).toContain('conic-gradient');
    expect(activeSx.marginBottom).toBe('-1px');
    expect(activeSx['&::after']).toBeUndefined();
  });

  it('shows coloured gradient baseline on inactive tab cells', () => {
    const inactiveSx = getFolderTabSx(false, 2) as Record<string, unknown>;
    const afterPseudo = inactiveSx['&::after'] as Record<string, unknown>;
    expect(inactiveSx.border).toBe('none');
    expect(inactiveSx.bgcolor).toBe('#F8FAFC');
    expect(afterPseudo?.background).toBe(FOLDER_TAB_CARD_GRADIENT);
    expect(afterPseudo?.height).toBe('3px');
  });

  it('rounds outer corners for first and last active tabs', () => {
    const firstActive = getFolderTabSx(true, 0, 3) as Record<string, unknown>;
    const lastActive = getFolderTabSx(true, 2, 3) as Record<string, unknown>;
    expect(firstActive.borderTopLeftRadius).toBe('22px');
    expect(lastActive.borderTopRightRadius).toBe('22px');
  });
});
