import { describe, expect, it, vi } from 'vitest';
import {
  SMART_BACKGROUND_SETUP_ELEMENT_ID,
  SMART_BACKGROUND_SETUP_TAB_INDEX,
  scrollToBackgroundSetup,
} from './backgroundSetupNavigation';

describe('backgroundSetupNavigation', () => {
  it('exports stable tab index and element id', () => {
    expect(SMART_BACKGROUND_SETUP_TAB_INDEX).toBe(2);
    expect(SMART_BACKGROUND_SETUP_ELEMENT_ID).toBe('smart-background-setup');
  });

  it('scrolls to the smart background setup anchor', () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    const element = document.createElement('div');
    element.id = SMART_BACKGROUND_SETUP_ELEMENT_ID;
    element.scrollIntoView = scrollIntoView;
    document.body.appendChild(element);

    scrollToBackgroundSetup(100);
    expect(scrollIntoView).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    document.body.removeChild(element);
    vi.useRealTimers();
  });
});
