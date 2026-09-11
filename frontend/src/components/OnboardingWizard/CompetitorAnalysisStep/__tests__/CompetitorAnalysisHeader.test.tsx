import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CompetitorAnalysisHeader } from '../CompetitorAnalysisHeader';
import { WEBSITE_STEP_HEADER_TOP_MARGIN } from '../../WebsiteStep/constants/websiteStepLayout';

const theme = createTheme();

const defaultProps = {
  isAnalyzing: false,
  onRunFreshAnalysis: vi.fn(),
  onOpenBackgroundSetup: vi.fn(),
};

describe('CompetitorAnalysisHeader', () => {
  it('renders updated hero title and subtitle', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader {...defaultProps} />
      </ThemeProvider>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Know Your Competitive Landscape/i
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      /ALwrity discovers your competitors, maps their content strategy/i
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      /built on real market data/i
    );
  });

  it('applies the same top spacing contract as WebsiteStepHeader', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader {...defaultProps} />
      </ThemeProvider>
    );

    const header = screen.getByTestId('research-step-header');
    expect(header).toHaveAttribute('data-top-spacing-xs', String(WEBSITE_STEP_HEADER_TOP_MARGIN.xs));
    expect(header).toHaveAttribute('data-top-spacing-md', String(WEBSITE_STEP_HEADER_TOP_MARGIN.md));
  });

  it('places action buttons on the same row as the title', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader {...defaultProps} />
      </ThemeProvider>
    );

    const titleRow = screen.getByTestId('research-step-title-row');
    expect(within(titleRow).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(titleRow).getByRole('button', { name: /Run Fresh Analysis/i })).toBeInTheDocument();
    expect(within(titleRow).getByRole('button', { name: /Smart Background Setup/i })).toBeInTheDocument();
    expect(within(titleRow).getByRole('button', { name: /What ALwrity does/i })).toBeInTheDocument();
  });

  it('opens info modal on info click', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader {...defaultProps} />
      </ThemeProvider>
    );

    expect(screen.queryByText('What ALwrity does?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /What ALwrity does/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('What ALwrity does?').length).toBeGreaterThan(0);
  });

  it('invokes analysis and background setup handlers', () => {
    const onRunFreshAnalysis = vi.fn();
    const onOpenBackgroundSetup = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader
          {...defaultProps}
          onRunFreshAnalysis={onRunFreshAnalysis}
          onOpenBackgroundSetup={onOpenBackgroundSetup}
        />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Run Fresh Analysis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Smart Background Setup/i }));
    expect(onRunFreshAnalysis).toHaveBeenCalledTimes(1);
    expect(onOpenBackgroundSetup).toHaveBeenCalledTimes(1);
  });
});
