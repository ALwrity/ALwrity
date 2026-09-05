import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { WizardNavigation } from '../WizardNavigation';
import {
  WIZARD_ACTIVE_NEXT_BUTTON_GRADIENT,
  WIZARD_ACTIVE_NEXT_BUTTON_HOVER_GRADIENT,
} from '../onboardingButtonStyles';

const theme = createTheme();

describe('WizardNavigation', () => {
  it('uses footer padding aligned with the navigation header', () => {
    render(
      <ThemeProvider theme={theme}>
        <WizardNavigation
          activeStep={1}
          totalSteps={4}
          onBack={vi.fn()}
          onNext={vi.fn()}
          isLastStep={false}
          isCurrentStepValid={true}
          nextLabel="Continue"
        />
      </ThemeProvider>
    );

    expect(screen.getByTestId('wizard-footer-bar')).toBeInTheDocument();
  });

  it('uses pink-purple-indigo gradient on the active Continue button', () => {
    render(
      <ThemeProvider theme={theme}>
        <WizardNavigation
          activeStep={1}
          totalSteps={4}
          onBack={vi.fn()}
          onNext={vi.fn()}
          isLastStep={false}
          isCurrentStepValid={true}
          nextLabel="Continue"
        />
      </ThemeProvider>
    );

    const nextButton = screen.getByTestId('wizard-next-button');
    expect(nextButton).toHaveAttribute('data-active-gradient', WIZARD_ACTIVE_NEXT_BUTTON_GRADIENT);
    expect(nextButton).toHaveAttribute('data-hover-gradient', WIZARD_ACTIVE_NEXT_BUTTON_HOVER_GRADIENT);
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onNext when the active button is clicked', () => {
    const onNext = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <WizardNavigation
          activeStep={0}
          totalSteps={4}
          onBack={vi.fn()}
          onNext={onNext}
          isLastStep={false}
          isCurrentStepValid={true}
          nextLabel="ALwrity Your Growth"
        />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('wizard-next-button'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
