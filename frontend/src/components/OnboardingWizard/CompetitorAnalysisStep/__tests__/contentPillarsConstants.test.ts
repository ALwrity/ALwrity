import { describe, it, expect } from 'vitest';
import {
  formatBrandPillarTitle,
  getContentPillarListMinHeight,
} from '../contentPillarsConstants';

describe('contentPillarsConstants', () => {
  it('formatBrandPillarTitle strips www prefix from domain', () => {
    expect(formatBrandPillarTitle('www.alwrity.com')).toBe('alwrity.com');
    expect(formatBrandPillarTitle('alwrity.com')).toBe('alwrity.com');
    expect(formatBrandPillarTitle('')).toBe('Your Brand');
  });

  it('getContentPillarListMinHeight uses tallest pillar list', () => {
    expect(getContentPillarListMinHeight([2, 5, 3])).toBe(5 * 28 + 36);
    expect(getContentPillarListMinHeight([])).toBe(140);
  });
});
