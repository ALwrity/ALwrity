import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ResearchStepInfoModal, RESEARCH_INFO_PANEL_TITLE } from '../ResearchStepInfoModal';

const theme = createTheme();

describe('ResearchStepInfoModal', () => {
  it('renders centered title and What/Why/How labels', () => {
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepInfoModal open onClose={() => {}} />
      </ThemeProvider>
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(RESEARCH_INFO_PANEL_TITLE);
    const panel = screen.getByTestId('research-step-info-panel');
    expect(panel).toHaveTextContent('What');
    expect(panel).toHaveTextContent('Why');
    expect(panel).toHaveTextContent('How');
  });

  it('styles What/Why/How with Discovered Competitors section color', () => {
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepInfoModal open onClose={() => {}} />
      </ThemeProvider>
    );

    const panel = screen.getByTestId('research-step-info-panel');
    expect(panel.querySelector('h6')).toHaveTextContent('What');
    expect(panel).toHaveTextContent('We analyze top competitors in your niche.');
  });

  it('calls onClose when the dialog close control is clicked', () => {
    const onClose = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepInfoModal open onClose={onClose} />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('onboarding-dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
