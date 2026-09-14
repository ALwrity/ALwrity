import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CompetitorAnalysisHeader, RESEARCH_STEP_SUBTITLE } from '../CompetitorAnalysisHeader';
import { RESEARCH_INFO_MODAL_TITLE, RESEARCH_INFO_PANEL_TITLE } from '../researchStepInfoConstants';
import {
  RESEARCH_STEP_HEADER_BOTTOM_MARGIN,
  RESEARCH_STEP_HEADER_TOP_MARGIN,
} from '../researchStepSectionStyles';

const theme = createTheme();

describe('CompetitorAnalysisHeader', () => {
  it('renders updated hero title, subtitle, and inline info icon after Landscape', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader />
      </ThemeProvider>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Know Your Competitive Landscape/i);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(RESEARCH_STEP_SUBTITLE);
    expect(screen.getByRole('button', { name: RESEARCH_INFO_MODAL_TITLE })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run Fresh Analysis/i })).not.toBeInTheDocument();
  });

  it('uses balanced top spacing and extra bottom spacing before social section', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader />
      </ThemeProvider>
    );

    const header = screen.getByTestId('research-step-header');
    expect(header).toHaveAttribute('data-top-spacing-xs', String(RESEARCH_STEP_HEADER_TOP_MARGIN.xs));
    expect(header).toHaveAttribute('data-top-spacing-md', String(RESEARCH_STEP_HEADER_TOP_MARGIN.md));
    expect(RESEARCH_STEP_HEADER_BOTTOM_MARGIN).toBeGreaterThanOrEqual(2);
  });

  it('toggles collapse info panel on info click and closes with the panel close button', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorAnalysisHeader />
      </ThemeProvider>
    );

    expect(screen.queryByTestId('research-step-info-panel')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: RESEARCH_INFO_MODAL_TITLE }));
    expect(screen.getByTestId('research-step-info-panel')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: RESEARCH_INFO_PANEL_TITLE })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('research-step-info-panel-close'));
    expect(screen.getByRole('button', { name: RESEARCH_INFO_MODAL_TITLE })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});
