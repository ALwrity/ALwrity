import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CompetitorAnalysisHeader } from '../CompetitorAnalysisHeader';
import { WEBSITE_STEP_HEADER_TOP_MARGIN } from '../../WebsiteStep/constants/websiteStepLayout';
import { RESEARCH_INFO_MODAL_TITLE, RESEARCH_INFO_PANEL_TITLE } from '../ResearchStepInfoModal';

const theme = createTheme();

const defaultProps = {
  isAnalyzing: false,
  onRunFreshAnalysis: vi.fn(),
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

  it('places action buttons on the same row as the title without background setup shortcut', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader {...defaultProps} />
      </ThemeProvider>
    );

    const titleRow = screen.getByTestId('research-step-title-row');
    expect(within(titleRow).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(titleRow).getByRole('button', { name: /Run Fresh Analysis/i })).toBeInTheDocument();
    expect(within(titleRow).getByRole('button', { name: RESEARCH_INFO_MODAL_TITLE })).toBeInTheDocument();
    expect(within(titleRow).queryByRole('button', { name: /Smart Background Setup/i })).not.toBeInTheDocument();
  });

  it('toggles collapse info panel on info click with centered title', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader {...defaultProps} />
      </ThemeProvider>
    );

    expect(screen.queryByTestId('research-step-info-panel')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: RESEARCH_INFO_MODAL_TITLE }));
    expect(screen.getByTestId('research-step-info-panel')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: RESEARCH_INFO_PANEL_TITLE })).toBeInTheDocument();
    expect(screen.getByText('We analyze top competitors in your niche.')).toBeInTheDocument();
  });

  it('invokes fresh analysis handler', () => {
    const onRunFreshAnalysis = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader {...defaultProps} onRunFreshAnalysis={onRunFreshAnalysis} />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Run Fresh Analysis/i }));
    expect(onRunFreshAnalysis).toHaveBeenCalledTimes(1);
  });
});
