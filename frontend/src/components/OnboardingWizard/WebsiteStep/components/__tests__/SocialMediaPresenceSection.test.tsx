import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SocialMediaPresenceSection from '../SocialMediaPresenceSection';
import {
  SOCIAL_MEDIA_PRESENCE_CAPTION,
  SOCIAL_MEDIA_PRESENCE_INFO_TOOLTIP,
} from '../socialMediaPresenceConstants';

const theme = createTheme();

describe('SocialMediaPresenceSection', () => {
  it('renders heading, info icon, inline caption, and run fresh analysis on the same header row', () => {
    const onRunFreshAnalysis = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <SocialMediaPresenceSection
          socialMediaAccounts={{
            facebook: 'https://www.facebook.com/people/Alwrity/61559155311692/',
          }}
          onRunFreshAnalysis={onRunFreshAnalysis}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('heading', { level: 6, name: /Social Media Presence/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Social media presence information/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Fresh Analysis/i })).toBeInTheDocument();
    const headerRow = screen.getByTestId('social-media-presence-header-row');
    const caption = screen.getByTestId('social-media-presence-caption');
    expect(headerRow).toContainElement(caption);
    expect(caption).toHaveTextContent(SOCIAL_MEDIA_PRESENCE_CAPTION);
    expect(SOCIAL_MEDIA_PRESENCE_INFO_TOOLTIP).toContain('personalization');

    fireEvent.click(screen.getByRole('button', { name: /Run Fresh Analysis/i }));
    expect(onRunFreshAnalysis).toHaveBeenCalledTimes(1);
  });

  it('shows platform icon inside the edit field when editing', () => {
    render(
      <ThemeProvider theme={theme}>
        <SocialMediaPresenceSection socialMediaAccounts={{}} />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('social-pill-facebook'));
    expect(screen.getByTestId('social-edit-field-facebook')).toBeInTheDocument();
    expect(screen.getByTestId('social-edit-icon-facebook')).toBeInTheDocument();
  });

  it('marks inactive pills as disconnected', () => {
    render(
      <ThemeProvider theme={theme}>
        <SocialMediaPresenceSection socialMediaAccounts={{}} />
      </ThemeProvider>
    );

    expect(screen.getByTestId('social-pill-twitter')).toHaveAttribute('data-connected', 'false');
    expect(screen.getByTestId('social-pill-facebook')).toHaveAttribute('data-connected', 'false');
  });
});
