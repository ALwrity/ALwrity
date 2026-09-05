import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import WebsiteStepHeader from '../WebsiteStepHeader';
import { WEBSITE_STEP_HEADER_TOP_MARGIN } from '../../constants/websiteStepLayout';

const theme = createTheme();

describe('WebsiteStepHeader', () => {
  it('renders the onboarding hero title', () => {
    render(
      <ThemeProvider theme={theme}>
        <WebsiteStepHeader />
      </ThemeProvider>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Where should I begin \?/i);
  });

  it('applies increased top spacing below the wizard stepper', () => {
    render(
      <ThemeProvider theme={theme}>
        <WebsiteStepHeader />
      </ThemeProvider>
    );

    const header = screen.getByTestId('website-step-header');
    expect(header).toHaveAttribute(
      'data-top-spacing-xs',
      String(WEBSITE_STEP_HEADER_TOP_MARGIN.xs)
    );
    expect(header).toHaveAttribute(
      'data-top-spacing-md',
      String(WEBSITE_STEP_HEADER_TOP_MARGIN.md)
    );
  });
});
