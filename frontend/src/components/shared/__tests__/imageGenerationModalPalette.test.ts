import { LINKEDIN_THEME } from '../ImageGenerationPresets';
import {
  buildImageGenerationSelectMenuProps,
  resolveImageModalPalette,
} from '../imageGenerationModalPalette';
import { DEFAULT_THEME } from '../ImageGenerationModal.types';

describe('imageGenerationModalPalette', () => {
  it('defaults to dark palette when colorScheme is omitted', () => {
    const palette = resolveImageModalPalette(DEFAULT_THEME);

    expect(palette.colorScheme).toBe('dark');
    expect(palette.textPrimary).toBe('#ffffff');
    expect(palette.menuPaperBg).toBe('#1e293b');
  });

  it('resolves light LinkedIn Studio palette', () => {
    const palette = resolveImageModalPalette(LINKEDIN_THEME);

    expect(palette.colorScheme).toBe('light');
    expect(palette.dialogBackground).toBe('#ffffff');
    expect(palette.textPrimary).toBe('#1e293b');
    expect(palette.textSecondary).toBe('#64748b');
    expect(palette.menuPaperBg).toBe('#ffffff');
    expect(palette.inputBg).toBe('#f8fafc');
  });

  it('builds light select menus with correct paper styling', () => {
    const palette = resolveImageModalPalette(LINKEDIN_THEME);
    const menuProps = buildImageGenerationSelectMenuProps(palette);

    expect(menuProps.PaperProps?.sx).toMatchObject({
      bgcolor: '#ffffff',
      border: '1px solid #e2e8f0',
    });
  });
});
