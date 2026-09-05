import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import OnboardingTabBar from '../OnboardingTabBar';

const theme = createTheme();

const baseProps = {
  activeTab: 'website' as const,
  setActiveTab: vi.fn(),
  hasWebsiteAnalysis: true,
  linkedinConnected: false,
  youtubeConnected: false,
  hasInput: true,
  showWebsiteUrlHoverPanel: true,
  website: 'https://www.alwrity.com',
  setWebsite: vi.fn(),
  websiteLoading: false,
  onAnalyze: vi.fn(),
  onAnalyzeNewWebsite: vi.fn(),
  backgroundTasks: null,
};

describe('OnboardingTabBar', () => {
  it('renders Website label instead of Website Analysis', () => {
    render(
      <ThemeProvider theme={theme}>
        <OnboardingTabBar {...baseProps} hasWebsiteAnalysis={false} showWebsiteUrlHoverPanel={false} />
      </ThemeProvider>
    );
    expect(screen.getByText('Website')).toBeInTheDocument();
    expect(screen.queryByText('Website Analysis')).not.toBeInTheDocument();
  });

  it('shows compact URL popover with URL field and Analyze New Website label', async () => {
    render(
      <ThemeProvider theme={theme}>
        <OnboardingTabBar {...baseProps} />
      </ThemeProvider>
    );

    fireEvent.mouseEnter(screen.getByText('Website'));

    await waitFor(() => {
      expect(screen.getByTestId('website-tab-url-popover')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('https://www.alwrity.com')).toBeInTheDocument();
    expect(screen.queryByTestId('analyzed-website-label')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze new website/i })).toBeInTheDocument();
  });

  it('renders LinkedIn and YouTube platform tabs', () => {
    render(
      <ThemeProvider theme={theme}>
        <OnboardingTabBar {...baseProps} />
      </ThemeProvider>
    );
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
  });
});
