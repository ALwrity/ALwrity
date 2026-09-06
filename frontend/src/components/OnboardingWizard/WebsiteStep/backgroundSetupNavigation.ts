export const SMART_BACKGROUND_SETUP_TAB_INDEX = 2;
export const SMART_BACKGROUND_SETUP_ELEMENT_ID = 'smart-background-setup';

export interface BackgroundSetupFocusRequest {
  token: number;
  taskKey?: string;
}

export function scrollToBackgroundSetup(delayMs = 150): void {
  window.setTimeout(() => {
    document.getElementById(SMART_BACKGROUND_SETUP_ELEMENT_ID)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, delayMs);
}
