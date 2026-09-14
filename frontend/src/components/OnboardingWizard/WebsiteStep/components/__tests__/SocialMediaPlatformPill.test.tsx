import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  SocialMediaPlatformPill,
  PILL_ACTION_EXPANDED_WIDTH,
  PILL_ACTION_ICON_GAP,
} from '../SocialMediaPlatformPill';
import { ALL_SOCIAL_PLATFORMS } from '../socialMediaPresenceConstants';

const theme = createTheme();
const facebook = ALL_SOCIAL_PLATFORMS.find((p) => p.key === 'facebook')!;

describe('SocialMediaPlatformPill', () => {
  it('renders visit and edit actions together for connected pills', () => {
    render(
      <ThemeProvider theme={theme}>
        <SocialMediaPlatformPill
          platform={facebook}
          isConnected={true}
          socialUrl="https://www.facebook.com/alwrity"
          onStartEdit={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByTestId('social-pill-visit-facebook')).toBeInTheDocument();
    expect(screen.getByTestId('social-pill-edit-facebook')).toBeInTheDocument();
    expect(PILL_ACTION_EXPANDED_WIDTH.connected).toBeGreaterThan(PILL_ACTION_EXPANDED_WIDTH.disconnected);
    expect(PILL_ACTION_ICON_GAP).toBeGreaterThan(0.5);
  });

  it('renders only edit action for disconnected pills', () => {
    render(
      <ThemeProvider theme={theme}>
        <SocialMediaPlatformPill
          platform={facebook}
          isConnected={false}
          socialUrl={null}
          onStartEdit={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.queryByTestId('social-pill-visit-facebook')).not.toBeInTheDocument();
    expect(screen.getByTestId('social-pill-edit-facebook')).toBeInTheDocument();
  });
});
